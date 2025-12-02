// Gerekli kütüphaneleri import et
const { Client, Events, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');

// Botumuzun hangi izinlere ihtiyacı olduğunu belirtiyoruz
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers 
    ]
});

// --- AYARLAR ---
const prefix = '!';
const REQUIRED_MEMBERS = 4; // Gerekli üye sayısı (lider hariç)
const BOT_TOKEN = ''; // BURAYA KENDİ TOKENINI GİR
// ---------------

// -----------------------------------------------------------------
// 🧠 BOTUN HAFIZASI (Turnuva Durumu)
// -----------------------------------------------------------------
let tournamentState = {
    isActive: false,
    isRegistrationOpen: false,
    participants: [],
    bracket: [], 
    currentRound: 0
};
// -----------------------------------------------------------------

// --- YARDIMCI EMBED FONKSİYONLARI ---
const createSuccessEmbed = (title, description) => {
    return new EmbedBuilder().setColor(0x57F287).setTitle(`✅ ${title}`).setDescription(description).setTimestamp();
};
const createErrorEmbed = (description) => {
    return new EmbedBuilder().setColor(0xED4245).setTitle('❌ Bir Hata Oluştu').setDescription(description).setTimestamp();
};
const createInfoEmbed = (title, description) => {
    return new EmbedBuilder().setColor(0x5865F2).setTitle(`ℹ️ ${title}`).setDescription(description).setTimestamp();
};
const createAnnouncementEmbed = (title, description) => {
    return new EmbedBuilder().setColor(0xFEE75C).setTitle(title).setDescription(description).setTimestamp();
};
// -----------------------------------------------------------------


// --- YARDIMCI FONKSİYON: Fisher-Yates Karıştırıcı ---
function shuffle(array) {
  let currentIndex = array.length,  randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}
// -----------------------------------------------------------------


// --- YARDIMCI FONKSİYON: Tur Atlatma ---
async function checkAndAdvanceRound(message) {
    const currentRoundMatches = tournamentState.bracket.filter(
        m => m.round === tournamentState.currentRound
    );

    const pendingMatches = currentRoundMatches.filter(m => m.status === 'pending');

    if (pendingMatches.length > 0) {
        // Hâlâ maçlar devam ediyor, sadece sonucu kaydet
        // Diskalifiye durumunda farklı mesaj verebilmek için bu mesajı !sonuc ve !diskalifiye içine taşıdık.
        return; // Tur atlama
    }

    // --- TUR TAMAMLANDI, YENİ TUR BAŞLIYOR ---
    const winners = currentRoundMatches.map(m => m.winner);

    // 1. Şampiyon Belli Oldu mu?
    if (winners.length === 1) {
        const champion = winners[0];
        const embed = createAnnouncementEmbed(
            '🎉 TURNUVANIN ŞAMPİYONU! 🎉',
            `Tebrikler **${champion.clanName}**! Rakiplerinizi yenerek şampiyon oldunuz! 👑`
        )
        .addFields({ name: 'Şampiyon Lider', value: `<@${champion.leaderId}>` })
        .setFooter({ text: 'Yeni bir turnuvada görüşmek üzere!' });
        
        message.channel.send({ content: '@everyone', embeds: [embed] });
        tournamentState = { isActive: false, isRegistrationOpen: false, participants: [], bracket: [], currentRound: 0 };
        return;
    }

    // 2. Henüz şampiyon belli değil, bir sonraki tura geç
    tournamentState.currentRound++;
    let shuffledWinners = shuffle(winners);
    let byeClan = null;
    let matchId = Math.max(...tournamentState.bracket.map(m => m.matchId)) + 1; 

    // 3. Tek sayı varsa (BYE)
    if (shuffledWinners.length % 2 !== 0) {
        byeClan = shuffledWinners.pop();
        const byeMatch = {
            matchId: matchId++, round: tournamentState.currentRound, team1: byeClan, team2: { clanName: 'BYE' }, winner: byeClan, status: 'completed'
        };
        tournamentState.bracket.push(byeMatch);
    }

    // 4. Kalanları eşleştir
    for (let i = 0; i < shuffledWinners.length; i += 2) {
        const team1 = shuffledWinners[i];
        const team2 = shuffledWinners[i + 1];
        const match = {
            matchId: matchId++, round: tournamentState.currentRound, team1: team1, team2: team2, winner: null, status: 'pending'
        };
        tournamentState.bracket.push(match);
    }

    // 5. Yeni Turu Duyur
    const newRoundEmbed = createAnnouncementEmbed(
        `🏆 ${tournamentState.currentRound}. TUR EŞLEŞMELERİ BAŞLIYOR! 🏆`,
        'Bir önceki turun kazananları eşleşti. Başarılar!'
    )
    .setFooter({ text: 'Sonuçları girmek için: !sonuc <MaçID> <KlanAdı>' });

    const newMatches = tournamentState.bracket.filter(m => m.round === tournamentState.currentRound);
    
    for (const match of newMatches) {
        if (match.team2.clanName === 'BYE') {
            newRoundEmbed.addFields({ name: `Maç #${match.matchId} (BYE)`, value: `➡️ **${match.team1.clanName}** klanı kura sonucu tur atladı!` });
        } else {
            newRoundEmbed.addFields({ name: `Maç #${match.matchId}`, value: `**${match.team1.clanName}**\nvs\n**${match.team2.clanName}**` });
        }
    }
    
    message.channel.send({ embeds: [newRoundEmbed] });
}
// -----------------------------------------------------------------


// Bot hazır olduğunda konsola bir mesaj yazdır
client.once(Events.ClientReady, c => {
    console.log(`Bot hazır! ${c.user.tag} olarak giriş yapıldı.`);
});

// Sunucuda bir mesaj oluşturulduğunda bu kod çalışacak
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // --- 1. Test Komutu ---
    if (command === 'ping') {
        const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('🏓 Pong!').addFields({ name: 'Gecikme', value: `${client.ws.ping}ms` });
        message.channel.send({ embeds: [embed] });
    }

    // --- 2. Turnuva Oluşturma Komutu (YÖNETİCİ) ---
    else if (command === 'turnuva_olustur') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.channel.send({ embeds: [createErrorEmbed('Bu komutu kullanmak için sunucu yöneticisi olmalısın.')] });
        }
        if (tournamentState.isActive) {
            return message.channel.send({ embeds: [createErrorEmbed('Zaten devam eden bir turnuva var. İptal etmek için `!turnuva_iptal` yazın.')] });
        }
        tournamentState = { isActive: true, isRegistrationOpen: true, participants: [], bracket: [], currentRound: 0 };
        const embed = createAnnouncementEmbed('🏆 YENİ TURNUVA OLUŞTURULDU 🏆', '@everyone Kayıtlar başladı! Klan liderleri klanlarını kaydedebilir.')
            .addFields(
                { name: 'Kayıt Komutu', value: '`!katil <Klanİsminiz> @üye1 @üye2 @üye3 @üye4`' },
                { name: 'Kural', value: `Lider hariç **tam olarak ${REQUIRED_MEMBERS} üye** etiketlenmelidir.` }
            ).setFooter({ text: 'Bol şans!' });
        message.channel.send({ content: '@everyone', embeds: [embed] });
    }

    // --- 3. Katılım Komutu (HERKES) ---
    else if (command === 'katil') {
        if (!tournamentState.isActive || !tournamentState.isRegistrationOpen) {
            return message.channel.send({ embeds: [createErrorEmbed('Şu anda kayıtlar açık değil veya aktif bir turnuva yok.')] });
        }
        const mentions = message.mentions.users;
        const klanAdiArgs = args.filter(arg => !arg.startsWith('<@'));
        const klanAdi = klanAdiArgs.join(' '); 
        if (!klanAdi) {
            return message.channel.send({ embeds: [createErrorEmbed('Lütfen bir klan adı girin.\n**Örnek:** `!katil Efsaneler @üye1 @üye2 @üye3 @üye4`')] });
        }
        if (mentions.size !== REQUIRED_MEMBERS) {
            return message.channel.send({ embeds: [createErrorEmbed(`Lider hariç **tam olarak ${REQUIRED_MEMBERS} üye** etiketlemeniz gerekiyor.`)] });
        }
        if (mentions.has(message.author.id)) {
            return message.channel.send({ embeds: [createErrorEmbed('Klan lideri olarak üyeler arasında kendini etiketleyemezsin.')] });
        }
        if (tournamentState.participants.find(clan => clan.leaderId === message.author.id)) {
            return message.channel.send({ embeds: [createErrorEmbed('Zaten bir klan kaydetmişsin!')] });
        }
        if (tournamentState.participants.find(clan => clan.clanName.toLowerCase() === klanAdi.toLowerCase())) {
            return message.channel.send({ embeds: [createErrorEmbed('Bu klan adı zaten başka bir lider tarafından alınmış.')] });
        }
        const taggedMemberIds = mentions.map(u => u.id);
        for (const existingClan of tournamentState.participants) {
            if (taggedMemberIds.includes(existingClan.leaderId)) {
                return message.channel.send({ embeds: [createErrorEmbed(`Etiketlediğin üyelerden biri (<@${existingClan.leaderId}>), **${existingClan.clanName}** klanının zaten lideri!`)] });
            }
            const foundMember = existingClan.members.find(m => taggedMemberIds.includes(m.id));
            if (foundMember) {
                 return message.channel.send({ embeds: [createErrorEmbed(`Etiketlediğin üyelerden biri (<@${foundMember.id}>), **${existingClan.clanName}** klanına zaten kayıtlı!`)] });
            }
        }
        const memberData = mentions.map(user => ({ id: user.id, tag: user.tag }));
        const newClan = { clanName: klanAdi, leaderId: message.author.id, leaderTag: message.author.tag, members: memberData };
        tournamentState.participants.push(newClan);
        const memberListString = memberData.map(m => `<@${m.id}>`).join('\n');
        const successEmbed = createSuccessEmbed('Kayıt Başarılı!', `**${klanAdi}** klanı turnuvaya başarıyla kaydoldu!`)
            .addFields(
                { name: 'Klan Lideri', value: `<@${message.author.id}>` },
                { name: `Üyeler (${memberData.length} kişi)`, value: memberListString },
                { name: 'Toplam Kayıtlı Klan', value: `${tournamentState.participants.length} adet` }
            );
        message.channel.send({ embeds: [successEmbed] });
    }

    // --- 4. Kayıtları Kapatma Komutu (YÖNETİCİ) ---
    else if (command === 'kayit_kapat') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.channel.send({ embeds: [createErrorEmbed('Bu komutu kullanmak için sunucu yöneticisi olmalısın.')] });
        }
        if (!tournamentState.isActive || !tournamentState.isRegistrationOpen) {
            return message.channel.send({ embeds: [createErrorEmbed('Kayıtlar zaten kapalı veya aktif bir turnuva yok.')] });
        }
        if (tournamentState.participants.length < 2) {
             return message.channel.send({ embeds: [createErrorEmbed(`Turnuvayı başlatmak için en az 2 klan gerekir. Mevcut klan sayısı: ${tournamentState.participants.length}`)] });
        }
        tournamentState.isRegistrationOpen = false;
        tournamentState.currentRound = 1;
        tournamentState.bracket = []; 
        let shuffledClans = shuffle([...tournamentState.participants]);
        let byeClan = null;
        let matchId = 1;
        if (shuffledClans.length % 2 !== 0) {
            byeClan = shuffledClans.pop();
            const byeMatch = { matchId: matchId++, round: 1, team1: byeClan, team2: { clanName: 'BYE' }, winner: byeClan, status: 'completed' };
            tournamentState.bracket.push(byeMatch);
        }
        for (let i = 0; i < shuffledClans.length; i += 2) {
            const team1 = shuffledClans[i];
            const team2 = shuffledClans[i + 1];
            const match = { matchId: matchId++, round: 1, team1: team1, team2: team2, winner: null, status: 'pending' };
            tournamentState.bracket.push(match);
        }
        const closeEmbed = createAnnouncementEmbed('🛑 KAYITLAR KAPANDI! 🛑', `Toplam **${tournamentState.participants.length}** klan kayıt oldu.`)
            .setDescription('Fikstür oluşturuldu! 1. Tur eşleşmeleri aşağıdadır:').setColor(0xED4245);
        message.channel.send({ embeds: [closeEmbed] });
        const bracketEmbed = createAnnouncementEmbed(`🏆 1. TUR EŞLEŞMELERİ 🏆`, 'Tüm klanlara başarılar dileriz!').setColor(0x5865F2);
        for (const match of tournamentState.bracket) {
            if (match.team2.clanName === 'BYE') {
                bracketEmbed.addFields({ name: `Maç #${match.matchId} (BYE)`, value: `➡️ **${match.team1.clanName}** klanı kura sonucu tur atladı!` });
            } else {
                bracketEmbed.addFields({ name: `Maç #${match.matchId}`, value: `**${match.team1.clanName}**\nvs\n**${match.team2.clanName}**` });
            }
        }
        message.channel.send({ embeds: [bracketEmbed] });
    }

    // --- 5. Katılımcıları Listeleme Komutu (YÖNETİCİ) ---
    else if (command === 'katilimcilar') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.channel.send({ embeds: [createErrorEmbed('Bu komutu sadece sunucu yöneticileri kullanabilir.')] });
        }
        if (!tournamentState.isActive) { return message.channel.send({ embeds: [createErrorEmbed('Aktif bir turnuva yok.')] }); }
        if (tournamentState.participants.length === 0) { return message.channel.send({ embeds: [createErrorEmbed('Henüz turnuvaya katılan bir klan yok.')] }); }
        const embed = createInfoEmbed(`Turnuva Katılımcıları (${tournamentState.participants.length} Klan)`, 'Kayıtlı klanların güncel listesi aşağıdadır.');
        tournamentState.participants.forEach((clan, index) => {
            const memberTags = clan.members.map(m => `<@${m.id}>`).join(', ') || 'Üye Yok';
            embed.addFields({
                name: `${index + 1}. ${clan.clanName}`,
                value: `**Lider:** <@${clan.leaderId}>\n**Üyeler (${clan.members.length}):** ${memberTags}`
            });
        });
        message.channel.send({ embeds: [embed] });
    }

    // --- 6. Turnuvayı İptal Etme Komutu (YÖNETİCİ) ---
    else if (command === 'turnuva_iptal') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.channel.send({ embeds: [createErrorEmbed('Bu komutu kullanmak için sunucu yöneticisi olmalısın.')] });
        }
        if (!tournamentState.isActive) { return message.channel.send({ embeds: [createErrorEmbed('Zaten aktif bir turnuva yok.')] }); }
        tournamentState = { isActive: false, isRegistrationOpen: false, participants: [], bracket: [], currentRound: 0 };
        message.channel.send({ embeds: [createInfoEmbed('Turnuva İptal Edildi', 'Aktif turnuva başarıyla iptal edildi ve tüm veriler sıfırlandı.')] });
    }

    // --- 7. Fikstürü Gösterme Komutu (YÖNETİCİ) ---
    else if (command === 'fikstur') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.channel.send({ embeds: [createErrorEmbed('Bu komutu kullanmak için sunucu yöneticisi olmalısın.')] });
        }
        if (!tournamentState.isActive || tournamentState.currentRound === 0) {
            return message.channel.send({ embeds: [createErrorEmbed('Turnuva henüz başlamadı veya aktif bir fikstür yok.')] });
        }
        const currentRoundMatches = tournamentState.bracket.filter(m => m.round === tournamentState.currentRound);
        const embed = createInfoEmbed(`📊 FİKSTÜR DURUMU (${tournamentState.currentRound}. Tur)`, 'Mevcut turdaki maçların durumu aşağıdadır.');
        if (currentRoundMatches.length === 0) { embed.setDescription('Bu turda hiç maç bulunmuyor. (Turnuva bitmiş olabilir)'); }
        for (const match of currentRoundMatches) {
            let value;
            if (match.status === 'completed') {
                if (match.team2.clanName === 'BYE') { value = `➡️ **${match.team1.clanName}** (Tur atladı)`; } 
                else { value = `✅ **Kazanan:** **${match.winner.clanName}**`; }
            } else { value = `**${match.team1.clanName}** vs **${match.team2.clanName}**\n*Sonuç Bekleniyor...* ⏳`; }
            embed.addFields({ name: `Maç #${match.matchId}`, value: value });
        }
        message.channel.send({ embeds: [embed] });
    }

    // --- 8. Maç Sonucu Girme Komutu (YÖNETİCİ) ---
    else if (command === 'sonuc') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.channel.send({ embeds: [createErrorEmbed('Bu komutu kullanmak için sunucu yöneticisi olmalısın.')] });
        }
        if (!tournamentState.isActive || tournamentState.currentRound === 0) {
            return message.channel.send({ embeds: [createErrorEmbed('Sonuç girebilmek için turnuvanın başlamış olması gerekir.')] });
        }
        const matchIdInput = args[0];
        const winnerNameInput = args.slice(1).join(' '); 
        if (!matchIdInput || !winnerNameInput) {
            return message.channel.send({ embeds: [createErrorEmbed('Eksik bilgi girdiniz.\n**Kullanım:** `!sonuc <MaçID> <KazananKlanAdı>`')] });
        }
        const matchId = parseInt(matchIdInput);
        const match = tournamentState.bracket.find(m => m.matchId === matchId && m.round === tournamentState.currentRound);
        if (!match) {
            return message.channel.send({ embeds: [createErrorEmbed(`Mevcut turda #${matchId} ID'li bir maç bulunamadı. Kontrol için \`!fikstur\` yazın.`)] });
        }
        if (match.status === 'completed') {
            return message.channel.send({ embeds: [createErrorEmbed(`Bu maçın sonucu zaten girilmiş (Kazanan: ${match.winner.clanName}).`)] });
        }
        let winnerClan = null;
        if (match.team1.clanName.toLowerCase() === winnerNameInput.toLowerCase()) {
            winnerClan = match.team1;
        } else if (match.team2.clanName && match.team2.clanName.toLowerCase() === winnerNameInput.toLowerCase()) {
            winnerClan = match.team2;
        }
        if (!winnerClan) {
            return message.channel.send({ embeds: [createErrorEmbed(`'${winnerNameInput}' adında bir klan bu maçta oynamıyor. Lütfen klan adını tam olarak doğru yazdığından emin ol.`)] });
        }
        match.winner = winnerClan;
        match.status = 'completed';
        
        // Sonuç girme mesajı (tur atlamadan önce)
        message.channel.send({ embeds: [
            createSuccessEmbed(
                'Sonuç Başarıyla Kaydedildi!',
                `Maç #${matchId} kazananı: **${winnerClan.clanName}**. Tur durumu kontrol ediliyor...`
            )
        ]});
        
        await checkAndAdvanceRound(message);
    }

    // --- 9. YENİ KOMUT: Maç Detayı (YÖNETİCİ) ---
    else if (command === 'mac_detay') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.channel.send({ embeds: [createErrorEmbed('Bu komutu kullanmak için sunucu yöneticisi olmalısın.')] });
        }
        if (!tournamentState.isActive) { return message.channel.send({ embeds: [createErrorEmbed('Aktif bir turnuva yok.')] }); }
        
        const matchIdInput = args[0];
        if (!matchIdInput) {
            return message.channel.send({ embeds: [createErrorEmbed('Lütfen detayını görmek istediğiniz maçın ID numarasını girin.\n**Kullanım:** `!mac_detay <MaçID>`')] });
        }

        const matchId = parseInt(matchIdInput);
        const match = tournamentState.bracket.find(m => m.matchId === matchId);

        if (!match) {
            return message.channel.send({ embeds: [createErrorEmbed(`Turnuva fikstüründe #${matchId} ID'li bir maç bulunamadı.`)] });
        }

        const embed = createInfoEmbed(`🔎 Maç Detayı: #${match.matchId}`, `Tur: ${match.round}`);

        // Durum Tespiti
        let statusText;
        if (match.status === 'pending') statusText = 'Sonuç Bekleniyor ⏳';
        else if (match.team2.clanName === 'BYE') statusText = 'BYE (Tur Atladı) ➡️';
        else statusText = `Tamamlandı (Kazanan: ${match.winner.clanName}) ✅`;
        embed.addFields({ name: 'Durum', value: statusText });

        // Takım 1 Bilgileri
        const team1 = match.team1;
        const team1Members = team1.members.map(m => `<@${m.id}>`).join(', ') || 'Üye Yok';
        embed.addFields({
            name: `1. Takım: ${team1.clanName}`,
            value: `**Lider:** <@${team1.leaderId}>\n**Üyeler:** ${team1Members}`
        });

        // Takım 2 Bilgileri (BYE değilse)
        if (match.team2.clanName !== 'BYE') {
            const team2 = match.team2;
            const team2Members = team2.members.map(m => `<@${m.id}>`).join(', ') || 'Üye Yok';
            embed.addFields({
                name: `2. Takım: ${team2.clanName}`,
                value: `**Lider:** <@${team2.leaderId}>\n**Üyeler:** ${team2Members}`
            });
        } else {
             embed.addFields({
                name: `2. Takım: BYE`,
                value: `Bu klan kura ile tur atladı.`
            });
        }
        
        message.channel.send({ embeds: [embed] });
    }

    // --- 10. YENİ KOMUT: Diskalifiye (YÖNETİCİ) ---
    else if (command === 'diskalifiye') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.channel.send({ embeds: [createErrorEmbed('Bu komutu kullanmak için sunucu yöneticisi olmalısın.')] });
        }
        if (!tournamentState.isActive) { return message.channel.send({ embeds: [createErrorEmbed('Aktif bir turnuva yok.')] }); }

        const klanAdi = args.join(' ');
        if (!klanAdi) {
            return message.channel.send({ embeds: [createErrorEmbed('Lütfen diskalifiye edilecek klanın adını tam olarak girin.\n**Kullanım:** `!diskalifiye <Klan Adı>`')] });
        }

        // Klanı katılımcı listesinde bul
        const klan = tournamentState.participants.find(p => p.clanName.toLowerCase() === klanAdi.toLowerCase());
        if (!klan) {
            return message.channel.send({ embeds: [createErrorEmbed(`'${klanAdi}' adında bir klan bu turnuvaya hiç katılmamış veya adı yanlış.`)] });
        }
        
        // --- SENARYO 1: Kayıtlar AÇIK ---
        if (tournamentState.isRegistrationOpen) {
            tournamentState.participants = tournamentState.participants.filter(p => p.leaderId !== klan.leaderId);
            return message.channel.send({ embeds: [
                createSuccessEmbed('Klan Diskalifiye Edildi (Kayıt Aşaması)', `**${klan.clanName}** klanı katılımcı listesinden silindi.`)
            ]});
        }

        // --- SENARYO 2: Turnuva BAŞLADI ---
        // Klanın mevcut turdaki BEKLEYEN (pending) maçını bul
        const match = tournamentState.bracket.find(m => 
            m.round === tournamentState.currentRound &&
            m.status === 'pending' &&
            (m.team1.leaderId === klan.leaderId || (m.team2.leaderId && m.team2.leaderId === klan.leaderId))
        );

        if (!match) {
            return message.channel.send({ embeds: [createErrorEmbed(`Klan bulundu fakat bu turda beklemede olan bir maçı yok. (Zaten elenmiş veya tur atlamış olabilir)`)] });
        }

        // Rakibi kazanan olarak ata
        const winnerClan = (match.team1.leaderId === klan.leaderId) ? match.team2 : match.team1;
        match.winner = winnerClan;
        match.status = 'completed';

        message.channel.send({ embeds: [
            createSuccessEmbed(
                'Klan Diskalifiye Edildi (Turnuva Aşaması)',
                `**${klan.clanName}** klanı diskalifiye edildi.\nMaç #${match.matchId} kazananı otomatik olarak **${winnerClan.clanName}** oldu.\nTur durumu kontrol ediliyor...`
            )
        ]});

        // Turu kontrol et ve gerekirse atlat
        await checkAndAdvanceRound(message);
    }

});


// Botu Discord'a bağla
client.login("MTQ0MjI0Mjc0NjkzNjIwMTMyNw.GVajV3.GV_yXb31VBa3MWKaoX82XqzmkdEbDQ1TeNY56s");