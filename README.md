# 🏆 Discord Turnuva & Etkinlik Botu

Bu bot, Discord sunucularında otomatik turnuvalar düzenlemenizi, eşleşmeleri ayarlamanızı ve skorları takip etmenizi sağlar.

## ✨ Özellikler
* ⚔️ **Otomatik Eşleşme:** Kayıt olan kullanıcıları rastgele eşleştirir.
* 📝 **Kayıt Sistemi:** `!katil` komutu ile kullanıcılar kolayca turnuvaya dahil olur.
* 👑 **Kazanan Belirleme:** Admin komutları ile kazananı bir üst tura taşıma.
* 📢 **Duyuru:** Maç sırası gelenleri etiketleyerek haber verir.

## 🛠️ Kurulum

1. Dosyaları indirin.
2. Gerekli modülleri yükleyin: npm install
3. index.js dosyasındaki yerleri kendinize göre düzenleyin
4. Botu Başaltın

🎮 Komutlar
!katil <KlanAdı> @üye1 @üye2 @üye3 @üye4
Ne işe yarar: Aktif bir turnuvaya klan kaydı yapar.

Kural: Komutu kullanan lider hariç tam olarak 4 üye etiketlenmesi zorunludur.
Sadece Yöneticilerin Kullanabileceği Komutlar
!turnuva_olustur
Ne işe yarar: Yeni bir turnuva başlatır, kayıtları açar ve !katil komutunun nasıl kullanılacağını duyurur.

!kayit_kapat
Ne işe yarar: Turnuva kayıtlarını kapatır.
Otomatik İşlev: Bu komut çalıştırıldığı an, bot tüm katılımcıları karıştırır, gerekirse BYE (tur atlayan) belirler ve 1. Tur eşleşmelerini otomatik olarak duyurur.

!katilimcilar
Ne işe yarar: Turnuvaya kayıtlı tüm klanların listesini, liderlerini ve etiketlenmiş üyelerini gösterir.

!fikstur
Ne işe yarar: Devam eden turdaki (1. Tur, 2. Tur vb.) maçların güncel durumunu gösterir.
Çıktı: Hangi maçın sonucunun beklendiğini (Sonuç Bekleniyor... ⏳
) veya hangi maçın kimin kazandığını (✅
 Kazanan: ...) listeler.

!sonuc <MaçID> <KazananKlanAdı>
Ne işe yarar: Bir maçın sonucunu bota kaydeder. (Örnek: !sonuc 3 Efsaneler).
Otomatik İşlev: Eğer girilen sonuç, o turdaki son maçın sonucuysa, bot otomatik olarak yeni turu (Finaller, Yarı Finaller vb.) başlatır ve duyurur. Geriye 1 klan kalırsa şampiyonu ilan eder.

!turnuva_iptal
turnuvayı kapatır ve kimse kayıt olamaz
