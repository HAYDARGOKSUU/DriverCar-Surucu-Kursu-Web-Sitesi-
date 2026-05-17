-- Sürücü Kursu Otomasyonu - PostgreSQL Database Initialization Script

-- 1. Kullanıcılar Tablosu (Giriş Yetkilendirme)
CREATE TABLE IF NOT EXISTS kullanicilar (
    id SERIAL PRIMARY KEY,
    kullanici_adi VARCHAR(50) UNIQUE NOT NULL,
    sifre TEXT NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'egitmen', 'personel')),
    ad_soyad VARCHAR(100) NOT NULL,
    yetkiler JSONB DEFAULT '{}',
    kayit_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Eğitmenler Tablosu
CREATE TABLE IF NOT EXISTS egitmenler (
    id SERIAL PRIMARY KEY,
    tc_no VARCHAR(11) UNIQUE NOT NULL,
    ad_soyad VARCHAR(100) NOT NULL,
    uzmanlik_alani VARCHAR(50), -- Örn: A, B, C, D Sınıfı Uzmanı
    durum VARCHAR(20) DEFAULT 'Aktif' CHECK (durum IN ('Aktif', 'Meşgul', 'İzinli')),
    telefon VARCHAR(20),
    maas NUMERIC(10, 2),
    fotograf_url TEXT,
    is_baslangic_tarihi DATE DEFAULT CURRENT_DATE
);

-- 3. Araç Filosu Tablosu
CREATE TABLE IF NOT EXISTS araclar (
    id SERIAL PRIMARY KEY,
    plaka VARCHAR(20) UNIQUE NOT NULL,
    marka_model VARCHAR(100) NOT NULL,
    vites_tipi VARCHAR(20) CHECK (vites_tipi IN ('Manuel', 'Otomatik')),
    ehliyet_sinifi VARCHAR(20), -- Örn: B, C, A2
    km INTEGER DEFAULT 0,
    bakima_kalan_km INTEGER DEFAULT 15000,
    durum VARCHAR(20) DEFAULT 'Aktif' CHECK (durum IN ('Aktif', 'Bakımda', 'Arızalı')),
    son_bakim_tarihi DATE
);

-- 4. Kursiyerler Tablosu (Ana Tablo)
CREATE TABLE IF NOT EXISTS kursiyerler (
    id SERIAL PRIMARY KEY,
    tc_no VARCHAR(11) UNIQUE NOT NULL,
    ad VARCHAR(50) NOT NULL,
    soyad VARCHAR(50) NOT NULL,
    dogum_tarihi DATE,
    cinsiyet VARCHAR(10),
    kan_grubu VARCHAR(10),
    telefon VARCHAR(20) NOT NULL,
    eposta VARCHAR(100),
    ogrenim_durumu VARCHAR(50),
    meslek VARCHAR(50),
    il VARCHAR(50),
    ilce VARCHAR(50),
    adres TEXT,
    
    -- Eğitim Bilgileri
    ehliyet_sinifi VARCHAR(20),
    vites_tercihi VARCHAR(20),
    egitmen_id INTEGER REFERENCES egitmenler(id) ON DELETE SET NULL,
    arac_id INTEGER REFERENCES araclar(id) ON DELETE SET NULL,
    
    -- Sınav Süreçleri
    e_sinav_tarihi DATE,
    e_sinav_puani INTEGER,
    direksiyon_sinav_tarihi DATE,
    direksiyon_sinav_durumu VARCHAR(20), -- Başarılı, Başarısız, Girmedi
    
    -- Ödeme Bilgileri
    toplam_ucret NUMERIC(10, 2),
    odeme_turu VARCHAR(20), -- Nakit, Kredi Kartı, Havale
    odeme_sekli VARCHAR(20), -- Peşin, Taksitli
    taksit_sayisi INTEGER DEFAULT 1,
    pesinat NUMERIC(10, 2) DEFAULT 0,
    
    -- Evrak Takibi (Checklist)
    evrak_adli_sicil BOOLEAN DEFAULT FALSE,
    evrak_diploma BOOLEAN DEFAULT FALSE,
    evrak_fotograf BOOLEAN DEFAULT FALSE,
    evrak_saglik_raporu BOOLEAN DEFAULT FALSE,
    
    -- Sistem Bilgileri
    fotograf_url TEXT,
    kayit_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    durum VARCHAR(20) DEFAULT 'Aktif' -- Aktif, Mezun, Ayrıldı
);

-- 5. Muhasebe & Finans Tablosu
CREATE TABLE IF NOT EXISTS muhasebe (
    id SERIAL PRIMARY KEY,
    is_tarihi DATE DEFAULT CURRENT_DATE,
    islem_tipi VARCHAR(10) CHECK (islem_tipi IN ('Gelir', 'Gider')),
    kategori VARCHAR(50), -- Kurs Ücreti, Maaş, Yakıt, Fatura vb.
    aciklama TEXT,
    tutar NUMERIC(12, 2) NOT NULL,
    kursiyer_id INTEGER REFERENCES kursiyerler(id) ON DELETE SET NULL, -- Eğer gelir bir kursiyere aitse
    kayit_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Sürüş Pratikleri & Randevu Takvimi (Detaylı/İlişkisel)
CREATE TABLE IF NOT EXISTS surus_pratikleri (
    id SERIAL PRIMARY KEY,
    tarih DATE NOT NULL,
    saat_baslangic TIME NOT NULL,
    saat_bitis TIME NOT NULL,
    egitmen_id INTEGER REFERENCES egitmenler(id) ON DELETE CASCADE,
    kursiyer_id INTEGER REFERENCES kursiyerler(id) ON DELETE CASCADE,
    arac_id INTEGER REFERENCES araclar(id) ON DELETE SET NULL,
    durum VARCHAR(20) DEFAULT 'Beklemede' CHECK (durum IN ('Beklemede', 'Tamamlandı', 'İptal')),
    notlar TEXT
);

-- 7. Sürüş Pratikleri (Basitleştirilmiş / Arayüzle Birebir Uyumlu)
CREATE TABLE IF NOT EXISTS pratik_kayitlari (
    id SERIAL PRIMARY KEY,
    tarih DATE NOT NULL,
    kursiyer VARCHAR(100) NOT NULL,
    konu VARCHAR(100) NOT NULL,
    sure INTEGER NOT NULL,
    durum VARCHAR(50) DEFAULT 'Tamamlandı'
);

-- Örnek Başlangıç Verileri (Opsiyonel)

-- Varsayılan Admin Kullanıcısı (Şifre: Admin123 - Normalde hashli saklanmalıdır)
INSERT INTO kullanicilar (kullanici_adi, sifre, rol, ad_soyad) 
VALUES ('admin', 'Admin123', 'admin', 'Sistem Yöneticisi')
ON CONFLICT (kullanici_adi) DO NOTHING;

-- Örnek Eğitmenler
INSERT INTO egitmenler (tc_no, ad_soyad, uzmanlik_alani, durum, telefon, maas)
VALUES 
('11111111111', 'Mehmet Özcan', 'B Sınıfı Uzmanı', 'Aktif', '05051112233', 25000.00),
('22222222222', 'Selin Aydın', 'A/A2 Sınıfı Uzmanı', 'Aktif', '05054445566', 22000.00)
ON CONFLICT (tc_no) DO NOTHING;

-- Örnek Araçlar
INSERT INTO araclar (plaka, marka_model, vites_tipi, ehliyet_sinifi, km, durum)
VALUES 
('06 ABC 123', 'Volkswagen Golf 2023', 'Manuel', 'B Sınıfı', 12450, 'Aktif'),
('34 XYZ 789', 'Hyundai i20 2024', 'Otomatik', 'B Sınıfı', 3100, 'Aktif')
ON CONFLICT (plaka) DO NOTHING;
SELECT * FROM kullanicilar;
