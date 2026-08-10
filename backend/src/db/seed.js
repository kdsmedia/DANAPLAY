import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';
import { runMigrations } from './schema.js';
import config from '../config/index.js';
import { uid, generateReferralCode } from '../utils/index.js';

function seed() {
  runMigrations();
  const db = getDb();

  // Admin user (default: admin / admin123) — change in production!
  const existingAdmin = db.prepare(`SELECT id FROM admin_users WHERE username = ?`).get('admin');
  if (!existingAdmin) {
    const hash = bcrypt.hashSync('admin123', config.bcryptRounds);
    db.prepare(`INSERT INTO admin_users (id, username, password_hash, role) VALUES (?,?,?, 'SUPER_ADMIN')`)
      .run(uid('adm_'), 'admin', hash);
    console.log('✅ Admin created: username=admin password=admin123 (CHANGE IMMEDIATELY)');
  }

  // Sample user (demo): phone 081234567890 / password password123
  const existingUser = db.prepare(`SELECT id FROM users WHERE phone = ?`).get('081234567890');
  if (!existingUser) {
    const hash = bcrypt.hashSync('password123', config.bcryptRounds);
    let code = generateReferralCode();
    while (db.prepare(`SELECT 1 FROM users WHERE referral_code=?`).get(code)) code = generateReferralCode();
    db.prepare(`INSERT INTO users (id, name, phone, password_hash, referral_code, points_balance, status) VALUES (?,?,?,?,?,?, 'ACTIVE')`)
      .run(uid('usr_'), 'Budi Demo', '081234567890', hash, code, 1250000);
    console.log(`✅ Demo user created: phone=081234567890 password=password123 referral_code=${code}`);
  }

  // Sample campaign GAME ABC with 4 milestones totaling 1.000.000
  const existingCampaign = db.prepare(`SELECT id FROM campaigns WHERE package_name = ?`).get('com.example.gameabc');
  if (!existingCampaign) {
    const cid = uid('cmp_');
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO campaigns (id, title, description, icon, package_name, store_url, tracking_url,
          reward_total, required_days, daily_requirement, status)
        VALUES (?,?,?,?,?,?,?,?,?,?, 'ACTIVE')
      `).run(cid, 'GAME ABC',
        'Main GAME ABC selama 15 hari berturut-turut untuk mendapatkan total 1.000.000 poin. Install, buka aplikasi, dan pertahankan aktivitas harian sampai hari ke-15.',
        '🎮', 'com.example.gameabc',
        'https://play.google.com/store/apps/details?id=com.example.gameabc',
        'https://play.google.com/store/apps/details?id=com.example.gameabc',
        1000000, 15,
        JSON.stringify({ expected_events: ['FIRST_OPEN', 'DAILY_ACTIVE'], min_daily_events: 1 }));
      const milestones = [
        ['INSTALL', 'Install aplikasi', 0, 100000, 0],
        ['DAY5', 'Hari ke-5', 5, 200000, 1],
        ['DAY10', 'Hari ke-10', 10, 300000, 2],
        ['DAY15', 'Hari ke-15 (selesai)', 15, 400000, 3],
      ];
      for (const [mid, label, day, reward, sort] of milestones) {
        db.prepare(`INSERT INTO campaign_milestones (id, campaign_id, milestone_id, label, day, reward_points, sort_order) VALUES (?,?,?,?,?,?,?)`)
          .run(uid('cm_'), cid, mid, label, day, reward, sort);
      }
    });
    tx();
    console.log('✅ Sample campaign GAME ABC created (4 milestones, total 1.000.000)');
  }

  // Second sample campaign
  const c2 = db.prepare(`SELECT id FROM campaigns WHERE package_name = ?`).get('com.example.fitrun');
  if (!c2) {
    const cid = uid('cmp_');
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO campaigns (id, title, description, icon, package_name, store_url, tracking_url,
          reward_total, required_days, daily_requirement, status)
        VALUES (?,?,?,?,?,?,?,?,?,?, 'ACTIVE')
      `).run(cid, 'FIT RUN',
        'Aplikasi lari/kebugaran. Buka setiap hari selama 7 hari untuk mendapatkan 300.000 poin.',
        '🏃', 'com.example.fitrun',
        'https://play.google.com/store/apps/details?id=com.example.fitrun',
        'https://play.google.com/store/apps/details?id=com.example.fitrun',
        300000, 7,
        JSON.stringify({ expected_events: ['FIRST_OPEN', 'DAILY_ACTIVE'] }));
      db.prepare(`INSERT INTO campaign_milestones (id, campaign_id, milestone_id, label, day, reward_points, sort_order) VALUES (?,?,?,?,?,?,?)`)
        .run(uid('cm_'), cid, 'INSTALL', 'Install', 0, 50000, 0);
      db.prepare(`INSERT INTO campaign_milestones (id, campaign_id, milestone_id, label, day, reward_points, sort_order) VALUES (?,?,?,?,?,?,?)`)
        .run(uid('cm_'), cid, 'DAY7', 'Hari ke-7', 7, 250000, 1);
    });
    tx();
    console.log('✅ Sample campaign FIT RUN created');
  }

  // Dynamic ad inventory (daily ad-watching task). Real ad creatives come from an ad SDK
  // (AdMob/Meta Audience Network) later; these rows are placeholder inventory the backend
  // serves dynamically by weight. reward_points snapshots the per-view reward from config.
  const existingAd = db.prepare(`SELECT id FROM ads WHERE advertiser = ?`).get('DemoAds');
  if (!existingAd) {
    const ads = [
      ['Makanan Sehat', 'Iklan restoran salad sehat', 'DemoAds', 30, config.adRewardPerView, 3],
      ['Game Petualangan', 'Promo game RPG mobile', 'DemoAds', 30, config.adRewardPerView, 5],
      ['E-Wallet Cashback', 'Promo cashback dompet digital', 'DemoAds', 30, config.adRewardPerView, 4],
      ['Pulsa Murah', 'Iklan provider pulsa', 'DemoAds', 30, config.adRewardPerView, 2],
      ['Sepatu Olahraga', 'Diskon sepatu lari', 'DemoAds', 30, config.adRewardPerView, 2],
      ['Kopi Pagi', 'Promo kafein pagi hari', 'DemoAds', 30, config.adRewardPerView, 3],
      ['Asuransi Digital', 'Iklan asuransi mikro', 'DemoAds', 30, config.adRewardPerView, 1],
      ['Streaming Musik', 'Promo langganan musik', 'DemoAds', 30, config.adRewardPerView, 3],
    ];
    const ins = db.prepare(`INSERT INTO ads (id, title, description, advertiser, creative_url, duration_seconds, reward_points, weight, status) VALUES (?,?,?,?,?,?,?,?, 'ACTIVE')`);
    const tx = db.transaction(() => {
      for (const [title, desc, adv, dur, reward, weight] of ads) {
        ins.run(uid('ad_'), title, desc, adv, '', dur, reward, weight);
      }
    });
    tx();
    console.log(`✅ Ad inventory created (${ads.length} ads, ${config.adRewardPerView} pts/view)`);
  }

  console.log('✅ Seed complete.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
}

export { seed };
