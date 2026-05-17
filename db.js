/**
 * Veritabanı Bağlantı Yapılandırması
 * Bu dosya, PostgreSQL veritabanı ile uygulama arasındaki bağlantıyı yönetir.
 * Bağlantı havuzu (Pool) kullanılarak performans optimize edilmiştir.
 */

const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL Bağlantı Havuzu Oluşturma
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'surucu_kursu',
    password: process.env.DB_PASSWORD || '123456', // .env dosyasından çekilir
    port: process.env.DB_PORT || 5432,
});

// Veritabanı Bağlantı Testi
pool.connect((err, client, release) => {
    if (err) {
        return console.error('\n[!] Veritabanı Bağlantı Hatası:', err.stack);
    }
    console.log('\n[✓] PostgreSQL Veritabanına Başarıyla Bağlanıldı.');
    release(); // Bağlantıyı havuza geri bırak
});

module.exports = {
    /**
     * Genel Sorgu Fonksiyonu
     * @param {string} text - SQL Sorgusu
     * @param {Array} params - Sorgu Parametreleri
     */
    query: (text, params) => pool.query(text, params),
};
