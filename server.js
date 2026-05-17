/**
 * DRİVERCAR - Sürücü Kursu Otomasyonu Backend Sunucusu
 * Bu dosya, Express.js tabanlı REST API servislerini ve veritabanı yönetimini içerir.
 */

const express = require('express');
const cors = require('cors');
const db = require('./db'); // Veritabanı bağlantı modülü
const multer = require('multer'); // Dosya yükleme (Profil fotoğrafı) kütüphanesi
const path = require('path');
const fs = require('fs');
require('dotenv').config(); // .env dosyasındaki çevresel değişkenleri yükler

const app = express();
const PORT = process.env.PORT || 5000;

// Yüklenen fotoğrafların saklanacağı 'uploads' klasörünü kontrol et, yoksa oluştur
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer Yapılandırması: Fotoğrafların isimlendirilmesi ve saklanacağı yer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Sunucu Ara Yazılımları (Middleware)
app.use(cors()); // Farklı portlardan gelen isteklere izin verir
app.use(express.json({ limit: '10mb' })); // JSON veri tipini destekler
app.use('/uploads', express.static('uploads')); // Fotoğrafların URL üzerinden erişilmesini sağlar
app.use(express.static(__dirname)); // HTML, CSS ve JS dosyalarını sunar

// --- API UÇ NOKTALARI (ROUTES) ---

// Kök dizine (Ana Sayfaya) girildiğinde otomatik olarak giriş sayfasına yönlendir
app.get('/', (req, res) => {
    res.redirect('/giris.html');
});

/**
 * 1. Giriş Yap (Authentication)
 * Kullanıcı adı ve şifre kontrolü yaparak rol ve isim bilgisini döner.
 */
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db.query(
            'SELECT id, kullanici_adi, rol, ad_soyad, yetkiler FROM kullanicilar WHERE kullanici_adi = $1 AND sifre = $2',
            [username, password]
        );
        if (result.rows.length > 0) {
            res.json({ success: true, user: result.rows[0] });
        } else {
            res.status(401).json({ success: false, message: 'Hatalı kullanıcı adı veya şifre!' });
        }
    } catch (err) {
        console.error("Giriş Hatası:", err.message);
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

/**
 * 2. Kursiyer Yönetimi
 * Kayıtlı tüm kursiyerleri listeler veya tek bir kursiyer bilgisini TC ile getirir.
 */
app.get('/api/students', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM kursiyerler ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Veri çekilemedi' });
    }
});

app.get('/api/students/:tc_no', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM kursiyerler WHERE tc_no = $1', [req.params.tc_no]);
        if (result.rows.length > 0) res.json(result.rows[0]);
        else res.status(404).json({ error: 'Kursiyer bulunamadı' });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

/**
 * 3. Yeni Kursiyer Kaydı
 * Multipart form verisi olarak gelen kursiyer bilgilerini ve fotoğrafı veritabanına işler.
 */
app.post('/api/students', upload.fields([
    { name: 'fotograf', maxCount: 1 },
    { name: 'adli_sicil', maxCount: 1 },
    { name: 'saglik_raporu', maxCount: 1 },
    { name: 'diploma', maxCount: 1 },
    { name: 'kimlik', maxCount: 1 }
]), async (req, res) => {
    try {
        const s = req.body;
        const files = req.files || {};
        const clean = (val) => (val === "null" || val === "" || val === undefined) ? null : val;
        
        const getUrl = (fieldname) => files[fieldname] ? `http://localhost:5000/uploads/${files[fieldname][0].filename}` : null;

        const query = `
            INSERT INTO kursiyerler (
                tc_no, ad, soyad, dogum_tarihi, cinsiyet, kan_grubu, telefon, eposta, 
                ogrenim_durumu, meslek, il, ilce, adres, ehliyet_sinifi, vites_tercihi, 
                toplam_ucret, odeme_turu, odeme_sekli, taksit_sayisi, pesinat, 
                fotograf_url, url_adli_sicil, url_saglik_raporu, url_diploma, url_kimlik
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
            RETURNING *
        `;
        const values = [
            clean(s.tc_no), clean(s.ad), clean(s.soyad), clean(s.dogum_tarihi), clean(s.cinsiyet), clean(s.kan_grubu), clean(s.telefon), clean(s.eposta),
            clean(s.ogrenim_durumu), clean(s.meslek), clean(s.il), clean(s.ilce), clean(s.adres), clean(s.ehliyet_sinifi), clean(s.vites_tercihi),
            parseFloat(s.toplam_ucret) || 0, clean(s.odeme_turu), clean(s.odeme_sekli), parseInt(s.taksit_sayisi) || 0, parseFloat(s.pesinat) || 0,
            getUrl('fotograf'), getUrl('adli_sicil'), getUrl('saglik_raporu'), getUrl('diploma'), getUrl('kimlik')
        ];

        const result = await db.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Kayıt Hatası:', err.message);
        res.status(500).json({ error: 'Veritabanı hatası' });
    }
});

/**
 * 3.1 Kursiyer Silme
 */
app.delete('/api/students/:tc_no', async (req, res) => {
    const tc = req.params.tc_no;
    console.log(`Silme isteği geldi: TC = [${tc}]`);
    try {
        const result = await db.query('DELETE FROM kursiyerler WHERE tc_no = $1', [tc]);
        console.log(`Silme sonucu: ${result.rowCount} satır silindi.`);
        
        if (result.rowCount > 0) {
            res.json({ success: true, message: 'Kursiyer başarıyla silindi.' });
        } else {
            res.status(404).json({ success: false, error: 'Kursiyer veritabanında bulunamadı.' });
        }
    } catch (err) {
        console.error('Silme Hatası:', err.message);
        res.status(500).json({ success: false, error: 'Veritabanı hatası: ' + err.message });
    }
});

/**
 * 4. Eğitmen ve Araç Yönetimi
 * Kurs bünyesindeki eğitmenleri ve araç filosunu yöneten API servisleri.
 */
app.get('/api/instructors', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM egitmenler');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Veri çekilemedi' });
    }
});

app.post('/api/instructors', upload.fields([
    { name: 'fotograf', maxCount: 1 },
    { name: 'adli_sicil', maxCount: 1 },
    { name: 'saglik_raporu', maxCount: 1 },
    { name: 'sertifika', maxCount: 1 }
]), async (req, res) => {
    try {
        const { tc_no, ad_soyad, uzmanlik_alani, telefon, maas } = req.body;
        const files = req.files || {};
        const getUrl = (fieldname) => files[fieldname] ? `http://localhost:5000/uploads/${files[fieldname][0].filename}` : null;

        const result = await db.query(
            'INSERT INTO egitmenler (tc_no, ad_soyad, uzmanlik_alani, telefon, maas, fotograf_url, url_adli_sicil, url_saglik_raporu, url_sertifika) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [tc_no, ad_soyad, uzmanlik_alani, telefon, maas, getUrl('fotograf'), getUrl('adli_sicil'), getUrl('saglik_raporu'), getUrl('sertifika')]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Eğitmen eklenemedi' });
    }
});

app.get('/api/vehicles', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM araclar');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Veri çekilemedi' });
    }
});

/**
 * 5. Muhasebe ve Finans İşlemleri
 * Gelir/Gider takibi, silme ve listeleme işlemleri.
 */
app.get('/api/transactions', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM muhasebe ORDER BY is_tarihi DESC, id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'İşlemler alınamadı' });
    }
});

app.post('/api/transactions', async (req, res) => {
    const { islem_tarihi, islem_tipi, kategori, aciklama, tutar } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO muhasebe (is_tarihi, islem_tipi, kategori, aciklama, tutar) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [islem_tarihi, islem_tipi, kategori, aciklama, tutar]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'İşlem kaydedilemedi' });
    }
});

app.delete('/api/transactions/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM muhasebe WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Silme hatası' });
    }
});

/**
 * 6. İstatistik ve Analiz
 * Dashboard üzerinde gösterilen grafikler için verileri (aylık kayıt, finansal özet vb.) toplar.
 */
app.get('/api/stats', async (req, res) => {
    try {
        const regResult = await db.query(`SELECT TO_CHAR(kayit_tarihi, 'Mon') as ay, COUNT(*) as sayi FROM kursiyerler GROUP BY ay, DATE_TRUNC('month', kayit_tarihi) ORDER BY DATE_TRUNC('month', kayit_tarihi)`);
        const branchResult = await db.query(`SELECT ehliyet_sinifi, COUNT(*) as sayi FROM kursiyerler GROUP BY ehliyet_sinifi`);
        const financeResult = await db.query(`SELECT islem_tipi, SUM(tutar) as toplam FROM muhasebe GROUP BY islem_tipi`);
        const summaryResult = await db.query(`SELECT (SELECT COUNT(*) FROM kursiyerler) as toplam_kursiyer, (SELECT COUNT(*) FROM egitmenler) as toplam_egitmen, (SELECT COUNT(*) FROM araclar) as toplam_arac`);

        res.json({
            registrations: regResult.rows,
            branches: branchResult.rows,
            finance: financeResult.rows,
            summary: summaryResult.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: 'İstatistikler alınamadı' });
    }
});

/**
 * 8. Kullanıcı ve Yetki Yönetimi
 */
app.get('/api/users', async (req, res) => {
    try {
        const result = await db.query('SELECT id, kullanici_adi, rol, ad_soyad, yetkiler FROM kullanicilar ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Kullanıcılar alınamadı' });
    }
});

app.post('/api/users', async (req, res) => {
    const { kullanici_adi, sifre, rol, ad_soyad, yetkiler } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO kullanicilar (kullanici_adi, sifre, rol, ad_soyad, yetkiler) VALUES ($1, $2, $3, $4, $5) RETURNING id, kullanici_adi, rol, ad_soyad, yetkiler',
            [kullanici_adi, sifre, rol, ad_soyad, JSON.stringify(yetkiler || {})]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Kullanıcı oluşturulamadı' });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { rol, ad_soyad, yetkiler } = req.body;
    try {
        const result = await db.query(
            'UPDATE kullanicilar SET rol = $1, ad_soyad = $2, yetkiler = $3 WHERE id = $4 RETURNING id, kullanici_adi, rol, ad_soyad, yetkiler',
            [rol, ad_soyad, JSON.stringify(yetkiler || {}), req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Kullanıcı güncellenemedi' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM kullanicilar WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Kullanıcı silinemedi' });
    }
});

/**
 * 7. Sürüş Pratikleri
 * Eğitim pratiği kayıtları çekme ve ekleme.
 */
app.get('/api/pratikler', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM pratik_kayitlari ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Veri çekilemedi' });
    }
});

app.post('/api/pratikler', async (req, res) => {
    const { tarih, kursiyer, konu, sure, durum } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO pratik_kayitlari (tarih, kursiyer, konu, sure, durum) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [tarih, kursiyer, konu, sure, durum]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Pratik kaydedilemedi' });
    }
});

// Sunucuyu Belirtilen Portta Başlat
app.listen(PORT, () => {
    console.log(`\n============================================`);
    console.log(`   DRİVERCAR OTOMASYON SUNUCUSU AKTİF`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Durum: Bağlantı Başarılı`);
    console.log(`============================================\n`);
});
