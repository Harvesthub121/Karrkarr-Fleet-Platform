/**
 * Karrkarr Pte Ltd — Idempotent seed script.
 *
 * Run: pnpm --filter @karrkarr/api prisma:seed
 *
 * What it creates:
 *   - 3 Singapore branches (Ubi, Tuas, Woodlands)
 *   - 5 admin users (one per role)
 *   - 40 vehicles with real SG plates, staggered compliance dates
 *   - 25 customers
 *   - Active rentals (WEEKLY + MONTHLY)
 *   - Invoices spanning all statuses including overdue with accrued interest
 *
 * Idempotency: every record is upserted on its natural unique key.
 * Running this twice leaves the DB in the same state as running it once.
 */

import { PrismaClient, Prisma, BillingFrequency, LedgerEntryType, InvoiceStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  calculateAccrual,
  firstAccrualDate,
  isoDate,
  toUtcMidnight,
} from '@karrkarr/shared';

const prisma = new PrismaClient();

const HASH = (pw: string) => bcrypt.hashSync(pw, 10);

// SGT offset for "today"
function sgtToday(): Date {
  const now = new Date();
  const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate()));
}

function daysAgo(n: number): Date {
  const d = sgtToday();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = sgtToday();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log('Seeding Karrkarr Pte Ltd...');

  // ── Branches ────────────────────────────────────────────────────────────────
  const [ubi, tuas, woodlands] = await Promise.all([
    prisma.branch.upsert({
      where: { code: 'UBI' },
      create: { code: 'UBI', name: 'Karrkarr Ubi', address: '3018 Ubi Road 1, #01-111, Singapore 408702', postal: '408702', phone: '+65 6100 1111' },
      update: {},
    }),
    prisma.branch.upsert({
      where: { code: 'TUAS' },
      create: { code: 'TUAS', name: 'Karrkarr Tuas', address: '20 Tuas West Drive, Singapore 638386', postal: '638386', phone: '+65 6100 2222' },
      update: {},
    }),
    prisma.branch.upsert({
      where: { code: 'WDL' },
      create: { code: 'WDL', name: 'Karrkarr Woodlands', address: '3 Woodlands Sector 1, Singapore 738349', postal: '738349', phone: '+65 6100 3333' },
      update: {},
    }),
  ]);
  console.log('Branches OK');

  // ── Admin Users ─────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.adminUser.upsert({
      where: { email: 'super@karrkarr.com.sg' },
      create: { email: 'super@karrkarr.com.sg', passwordHash: HASH('Karrkarr@2026!'), fullName: 'Super Admin', role: 'SUPER_ADMIN', passwordChangedAt: new Date() },
      update: {},
    }),
    prisma.adminUser.upsert({
      where: { email: 'ops@karrkarr.com.sg' },
      create: { email: 'ops@karrkarr.com.sg', passwordHash: HASH('Karrkarr@2026!'), fullName: 'Ops Officer', role: 'OPERATIONS', branchId: ubi.id, passwordChangedAt: new Date() },
      update: {},
    }),
    prisma.adminUser.upsert({
      where: { email: 'accounts@karrkarr.com.sg' },
      create: { email: 'accounts@karrkarr.com.sg', passwordHash: HASH('Karrkarr@2026!'), fullName: 'Accounts Manager', role: 'ACCOUNTS', passwordChangedAt: new Date() },
      update: {},
    }),
    prisma.adminUser.upsert({
      where: { email: 'branch@karrkarr.com.sg' },
      create: { email: 'branch@karrkarr.com.sg', passwordHash: HASH('Karrkarr@2026!'), fullName: 'Branch Manager Ubi', role: 'BRANCH_MANAGER', branchId: ubi.id, passwordChangedAt: new Date() },
      update: {},
    }),
    prisma.adminUser.upsert({
      where: { email: 'viewer@karrkarr.com.sg' },
      create: { email: 'viewer@karrkarr.com.sg', passwordHash: HASH('Karrkarr@2026!'), fullName: 'Read-Only Viewer', role: 'VIEWER', passwordChangedAt: new Date() },
      update: {},
    }),
  ]);
  console.log('Admin users OK');

  // ── Vehicles ────────────────────────────────────────────────────────────────
  // Real SG plate format: 3 alpha + 4 digits + 1 check letter (simplified)
  const vehicleData = [
    // Ubi branch
    { plate: 'SMR1337G', make: 'Toyota', model: 'Corolla Altis', year: 2021, branchId: ubi.id, weeklyRate: 52000n, monthlyRate: 200000n, coeExpiry: daysFromNow(92), roadTaxExpiry: daysFromNow(45), insuranceExpiry: daysFromNow(200), inspectionDue: daysFromNow(180) },
    { plate: 'SNA2288B', make: 'Honda', model: 'Vezel', year: 2022, branchId: ubi.id, weeklyRate: 58000n, monthlyRate: 220000n, coeExpiry: daysFromNow(400), roadTaxExpiry: daysFromNow(12), insuranceExpiry: daysFromNow(90), inspectionDue: daysFromNow(30) },
    { plate: 'SKA5512T', make: 'Hyundai', model: 'Avante', year: 2020, branchId: ubi.id, weeklyRate: 48000n, monthlyRate: 185000n, coeExpiry: daysFromNow(63), roadTaxExpiry: daysFromNow(120), insuranceExpiry: daysFromNow(60), inspectionDue: daysFromNow(7) },
    { plate: 'SBK3301H', make: 'Toyota', model: 'Sienta', year: 2021, branchId: ubi.id, weeklyRate: 55000n, monthlyRate: 210000n, coeExpiry: daysFromNow(180), roadTaxExpiry: daysFromNow(180), insuranceExpiry: daysFromNow(270), inspectionDue: daysFromNow(90) },
    { plate: 'SDK7745U', make: 'Nissan', model: 'NV200', year: 2020, branchId: ubi.id, weeklyRate: 60000n, monthlyRate: 230000n, coeExpiry: daysFromNow(500), roadTaxExpiry: daysFromNow(200), insuranceExpiry: daysFromNow(30), inspectionDue: daysFromNow(200) },
    { plate: 'SFM2203C', make: 'Toyota', model: 'Corolla Altis', year: 2022, branchId: ubi.id, weeklyRate: 52000n, monthlyRate: 200000n, coeExpiry: daysFromNow(700), roadTaxExpiry: daysFromNow(300), insuranceExpiry: daysFromNow(300), inspectionDue: daysFromNow(365) },
    { plate: 'SGP4456K', make: 'Honda', model: 'Vezel', year: 2021, branchId: ubi.id, weeklyRate: 58000n, monthlyRate: 220000n, coeExpiry: daysFromNow(600), roadTaxExpiry: daysFromNow(90), insuranceExpiry: daysFromNow(120), inspectionDue: daysFromNow(180) },
    { plate: 'SHA3389P', make: 'Hyundai', model: 'Avante', year: 2023, branchId: ubi.id, weeklyRate: 50000n, monthlyRate: 190000n, coeExpiry: daysFromNow(1200), roadTaxExpiry: daysFromNow(250), insuranceExpiry: daysFromNow(250), inspectionDue: daysFromNow(400) },
    { plate: 'SJB1122Z', make: 'Nissan', model: 'NV200', year: 2019, branchId: ubi.id, weeklyRate: 55000n, monthlyRate: 210000n, coeExpiry: daysFromNow(30), roadTaxExpiry: daysFromNow(14), insuranceExpiry: daysFromNow(14), inspectionDue: daysFromNow(60) },
    { plate: 'SKC6678A', make: 'Toyota', model: 'Sienta', year: 2022, branchId: ubi.id, weeklyRate: 55000n, monthlyRate: 210000n, coeExpiry: daysFromNow(800), roadTaxExpiry: daysFromNow(350), insuranceExpiry: daysFromNow(350), inspectionDue: daysFromNow(350) },
    { plate: 'SLD4412M', make: 'Toyota', model: 'Vios', year: 2022, branchId: ubi.id, weeklyRate: 45000n, monthlyRate: 175000n, coeExpiry: daysFromNow(900), roadTaxExpiry: daysFromNow(400), insuranceExpiry: daysFromNow(400), inspectionDue: daysFromNow(400) },
    { plate: 'SME5531J', make: 'Mitsubishi', model: 'Attrage', year: 2021, branchId: ubi.id, weeklyRate: 44000n, monthlyRate: 170000n, coeExpiry: daysFromNow(650), roadTaxExpiry: daysFromNow(220), insuranceExpiry: daysFromNow(220), inspectionDue: daysFromNow(220) },

    // Tuas branch
    { plate: 'SNF2278E', make: 'Nissan', model: 'NV200', year: 2021, branchId: tuas.id, weeklyRate: 62000n, monthlyRate: 240000n, coeExpiry: daysFromNow(400), roadTaxExpiry: daysFromNow(150), insuranceExpiry: daysFromNow(150), inspectionDue: daysFromNow(150) },
    { plate: 'SPG3314R', make: 'Toyota', model: 'Corolla Altis', year: 2020, branchId: tuas.id, weeklyRate: 50000n, monthlyRate: 195000n, coeExpiry: daysFromNow(88), roadTaxExpiry: daysFromNow(30), insuranceExpiry: daysFromNow(100), inspectionDue: daysFromNow(200) },
    { plate: 'SQH4456Y', make: 'Honda', model: 'Vezel', year: 2023, branchId: tuas.id, weeklyRate: 60000n, monthlyRate: 230000n, coeExpiry: daysFromNow(1500), roadTaxExpiry: daysFromNow(500), insuranceExpiry: daysFromNow(500), inspectionDue: daysFromNow(500) },
    { plate: 'SRK5523B', make: 'Hyundai', model: 'Avante', year: 2022, branchId: tuas.id, weeklyRate: 49000n, monthlyRate: 188000n, coeExpiry: daysFromNow(700), roadTaxExpiry: daysFromNow(300), insuranceExpiry: daysFromNow(300), inspectionDue: daysFromNow(300) },
    { plate: 'SSM1198D', make: 'Toyota', model: 'Sienta', year: 2020, branchId: tuas.id, weeklyRate: 53000n, monthlyRate: 205000n, coeExpiry: daysFromNow(56), roadTaxExpiry: daysFromNow(7), insuranceExpiry: daysFromNow(60), inspectionDue: daysFromNow(120) },
    { plate: 'STN6672G', make: 'Nissan', model: 'NV200', year: 2022, branchId: tuas.id, weeklyRate: 62000n, monthlyRate: 240000n, coeExpiry: daysFromNow(900), roadTaxExpiry: daysFromNow(400), insuranceExpiry: daysFromNow(400), inspectionDue: daysFromNow(400) },
    { plate: 'SUP7743H', make: 'Toyota', model: 'Vios', year: 2021, branchId: tuas.id, weeklyRate: 46000n, monthlyRate: 178000n, coeExpiry: daysFromNow(600), roadTaxExpiry: daysFromNow(250), insuranceExpiry: daysFromNow(250), inspectionDue: daysFromNow(250) },
    { plate: 'SVQ3367K', make: 'Toyota', model: 'Corolla Altis', year: 2021, branchId: tuas.id, weeklyRate: 51000n, monthlyRate: 198000n, coeExpiry: daysFromNow(350), roadTaxExpiry: daysFromNow(100), insuranceExpiry: daysFromNow(100), inspectionDue: daysFromNow(100) },
    { plate: 'SWR2243T', make: 'Honda', model: 'Jazz', year: 2022, branchId: tuas.id, weeklyRate: 47000n, monthlyRate: 182000n, coeExpiry: daysFromNow(800), roadTaxExpiry: daysFromNow(320), insuranceExpiry: daysFromNow(320), inspectionDue: daysFromNow(320) },

    // Woodlands branch
    { plate: 'SXS4456Z', make: 'Toyota', model: 'Corolla Altis', year: 2022, branchId: woodlands.id, weeklyRate: 52000n, monthlyRate: 200000n, coeExpiry: daysFromNow(500), roadTaxExpiry: daysFromNow(200), insuranceExpiry: daysFromNow(200), inspectionDue: daysFromNow(200) },
    { plate: 'SYT5512P', make: 'Honda', model: 'Vezel', year: 2021, branchId: woodlands.id, weeklyRate: 57000n, monthlyRate: 218000n, coeExpiry: daysFromNow(400), roadTaxExpiry: daysFromNow(160), insuranceExpiry: daysFromNow(160), inspectionDue: daysFromNow(160) },
    { plate: 'SZU6678A', make: 'Hyundai', model: 'Avante', year: 2020, branchId: woodlands.id, weeklyRate: 47000n, monthlyRate: 183000n, coeExpiry: daysFromNow(28), roadTaxExpiry: daysFromNow(14), insuranceExpiry: daysFromNow(7), inspectionDue: daysFromNow(30) },
    { plate: 'SAV7741B', make: 'Toyota', model: 'Sienta', year: 2023, branchId: woodlands.id, weeklyRate: 56000n, monthlyRate: 215000n, coeExpiry: daysFromNow(1200), roadTaxExpiry: daysFromNow(450), insuranceExpiry: daysFromNow(450), inspectionDue: daysFromNow(450) },
    { plate: 'SBW2298C', make: 'Nissan', model: 'NV200', year: 2021, branchId: woodlands.id, weeklyRate: 61000n, monthlyRate: 235000n, coeExpiry: daysFromNow(600), roadTaxExpiry: daysFromNow(280), insuranceExpiry: daysFromNow(280), inspectionDue: daysFromNow(280) },
    { plate: 'SCX3341D', make: 'Mitsubishi', model: 'Attrage', year: 2022, branchId: woodlands.id, weeklyRate: 44000n, monthlyRate: 170000n, coeExpiry: daysFromNow(700), roadTaxExpiry: daysFromNow(300), insuranceExpiry: daysFromNow(300), inspectionDue: daysFromNow(300) },
    { plate: 'SDY4479E', make: 'Toyota', model: 'Vios', year: 2020, branchId: woodlands.id, weeklyRate: 45000n, monthlyRate: 175000n, coeExpiry: daysFromNow(320), roadTaxExpiry: daysFromNow(100), insuranceExpiry: daysFromNow(100), inspectionDue: daysFromNow(100) },
    { plate: 'SEZ5512F', make: 'Honda', model: 'Jazz', year: 2021, branchId: woodlands.id, weeklyRate: 47000n, monthlyRate: 182000n, coeExpiry: daysFromNow(450), roadTaxExpiry: daysFromNow(180), insuranceExpiry: daysFromNow(180), inspectionDue: daysFromNow(180) },
    { plate: 'SFA6634G', make: 'Hyundai', model: 'Avante', year: 2022, branchId: woodlands.id, weeklyRate: 49000n, monthlyRate: 188000n, coeExpiry: daysFromNow(800), roadTaxExpiry: daysFromNow(360), insuranceExpiry: daysFromNow(360), inspectionDue: daysFromNow(360) },
    { plate: 'SGB7721H', make: 'Toyota', model: 'Corolla Altis', year: 2023, branchId: woodlands.id, weeklyRate: 54000n, monthlyRate: 207000n, coeExpiry: daysFromNow(1400), roadTaxExpiry: daysFromNow(500), insuranceExpiry: daysFromNow(500), inspectionDue: daysFromNow(500) },
    { plate: 'SHC1189K', make: 'Nissan', model: 'NV200', year: 2020, branchId: woodlands.id, weeklyRate: 59000n, monthlyRate: 225000n, coeExpiry: daysFromNow(200), roadTaxExpiry: daysFromNow(60), insuranceExpiry: daysFromNow(60), inspectionDue: daysFromNow(60) },
    { plate: 'SJD2234M', make: 'Honda', model: 'Vezel', year: 2020, branchId: woodlands.id, weeklyRate: 55000n, monthlyRate: 212000n, coeExpiry: daysFromNow(260), roadTaxExpiry: daysFromNow(80), insuranceExpiry: daysFromNow(80), inspectionDue: daysFromNow(80) },
    { plate: 'SKE3367P', make: 'Toyota', model: 'Sienta', year: 2021, branchId: woodlands.id, weeklyRate: 54000n, monthlyRate: 208000n, coeExpiry: daysFromNow(380), roadTaxExpiry: daysFromNow(140), insuranceExpiry: daysFromNow(140), inspectionDue: daysFromNow(140) },
    { plate: 'SLF4498R', make: 'Mitsubishi', model: 'Attrage', year: 2022, branchId: woodlands.id, weeklyRate: 43000n, monthlyRate: 168000n, coeExpiry: daysFromNow(750), roadTaxExpiry: daysFromNow(330), insuranceExpiry: daysFromNow(330), inspectionDue: daysFromNow(330) },
    { plate: 'SMG5523T', make: 'Toyota', model: 'Vios', year: 2023, branchId: woodlands.id, weeklyRate: 46000n, monthlyRate: 178000n, coeExpiry: daysFromNow(1100), roadTaxExpiry: daysFromNow(420), insuranceExpiry: daysFromNow(420), inspectionDue: daysFromNow(420) },
    { plate: 'SNH6641U', make: 'Honda', model: 'Jazz', year: 2021, branchId: woodlands.id, weeklyRate: 46000n, monthlyRate: 179000n, coeExpiry: daysFromNow(520), roadTaxExpiry: daysFromNow(210), insuranceExpiry: daysFromNow(210), inspectionDue: daysFromNow(210) },
    { plate: 'SPJ7712Z', make: 'Hyundai', model: 'Avante', year: 2022, branchId: woodlands.id, weeklyRate: 50000n, monthlyRate: 193000n, coeExpiry: daysFromNow(680), roadTaxExpiry: daysFromNow(270), insuranceExpiry: daysFromNow(270), inspectionDue: daysFromNow(270) },
  ];

  const vehicles: Record<string, string> = {}; // plate -> id
  for (const v of vehicleData) {
    const vehicle = await prisma.vehicle.upsert({
      where: { plateNumber: v.plate },
      create: {
        plateNumber: v.plate,
        make: v.make,
        model: v.model,
        year: v.year,
        branchId: v.branchId,
        status: 'AVAILABLE',
        defaultWeeklyRateCents: v.weeklyRate,
        defaultMonthlyRateCents: v.monthlyRate,
        coeExpiry: v.coeExpiry,
        roadTaxExpiry: v.roadTaxExpiry,
        insuranceExpiry: v.insuranceExpiry,
        inspectionDue: v.inspectionDue,
        accidentExcessCents: 200000n,
        isActive: true,
      },
      update: {},
    });
    vehicles[v.plate] = vehicle.id;
  }
  console.log(`Vehicles OK (${Object.keys(vehicles).length})`);

  // ── Customers ───────────────────────────────────────────────────────────────
  const customerData = [
    { ref: 'KR-C-00001', email: 'tan.wei.ming@gmail.com', fullName: 'Tan Wei Ming', phone: '+6591234567', branchId: ubi.id },
    { ref: 'KR-C-00002', email: 'lim.siew.khim@hotmail.com', fullName: 'Lim Siew Khim', phone: '+6592345678', branchId: ubi.id },
    { ref: 'KR-C-00003', email: 'ng.chee.keong@yahoo.com', fullName: 'Ng Chee Keong', phone: '+6593456789', branchId: ubi.id },
    { ref: 'KR-C-00004', email: 'goh.bee.leng@gmail.com', fullName: 'Goh Bee Leng', phone: '+6594567890', branchId: ubi.id },
    { ref: 'KR-C-00005', email: 'koh.kim.hock@gmail.com', fullName: 'Koh Kim Hock', phone: '+6595678901', branchId: ubi.id },
    { ref: 'KR-C-00006', email: 'chua.ah.kow@gmail.com', fullName: 'Chua Ah Kow', phone: '+6596789012', branchId: ubi.id },
    { ref: 'KR-C-00007', email: 'yeo.mei.ling@outlook.com', fullName: 'Yeo Mei Ling', phone: '+6597890123', branchId: ubi.id },
    { ref: 'KR-C-00008', email: 'ong.teck.boon@gmail.com', fullName: 'Ong Teck Boon', phone: '+6598901234', branchId: ubi.id },
    { ref: 'KR-C-00009', email: 'seah.swee.hua@gmail.com', fullName: 'Seah Swee Hua', phone: '+6599012345', branchId: tuas.id },
    { ref: 'KR-C-00010', email: 'lee.boon.seng@gmail.com', fullName: 'Lee Boon Seng', phone: '+6591122334', branchId: tuas.id },
    { ref: 'KR-C-00011', email: 'wong.kah.mun@yahoo.com', fullName: 'Wong Kah Mun', phone: '+6592233445', branchId: tuas.id },
    { ref: 'KR-C-00012', email: 'poh.geok.choo@gmail.com', fullName: 'Poh Geok Choo', phone: '+6593344556', branchId: tuas.id },
    { ref: 'KR-C-00013', email: 'chong.ah.meng@hotmail.com', fullName: 'Chong Ah Meng', phone: '+6594455667', branchId: tuas.id },
    { ref: 'KR-C-00014', email: 'lam.kwok.wai@gmail.com', fullName: 'Lam Kwok Wai', phone: '+6595566778', branchId: tuas.id },
    { ref: 'KR-C-00015', email: 'fong.sau.yee@gmail.com', fullName: 'Fong Sau Yee', phone: '+6596677889', branchId: tuas.id },
    { ref: 'KR-C-00016', email: 'ho.keng.wah@outlook.com', fullName: 'Ho Keng Wah', phone: '+6597788990', branchId: tuas.id },
    { ref: 'KR-C-00017', email: 'teo.siew.lan@gmail.com', fullName: 'Teo Siew Lan', phone: '+6598899001', branchId: woodlands.id },
    { ref: 'KR-C-00018', email: 'low.ah.chye@yahoo.com', fullName: 'Low Ah Chye', phone: '+6599900112', branchId: woodlands.id },
    { ref: 'KR-C-00019', email: 'chan.lai.fun@gmail.com', fullName: 'Chan Lai Fun', phone: '+6591011223', branchId: woodlands.id },
    { ref: 'KR-C-00020', email: 'wee.bock.kim@gmail.com', fullName: 'Wee Bock Kim', phone: '+6592122334', branchId: woodlands.id },
    { ref: 'KR-C-00021', email: 'heng.swee.keat@gmail.com', fullName: 'Heng Swee Keat', phone: '+6593233445', branchId: woodlands.id },
    { ref: 'KR-C-00022', email: 'quek.mui.hua@hotmail.com', fullName: 'Quek Mui Hua', phone: '+6594344556', branchId: woodlands.id },
    { ref: 'KR-C-00023', email: 'sng.kian.siong@gmail.com', fullName: 'Sng Kian Siong', phone: '+6595455667', branchId: woodlands.id },
    { ref: 'KR-C-00024', email: 'bong.tze.yong@outlook.com', fullName: 'Bong Tze Yong', phone: '+6596566778', branchId: woodlands.id },
    { ref: 'KR-C-00025', email: 'ang.peng.teck@gmail.com', fullName: 'Ang Peng Teck', phone: '+6597677889', branchId: woodlands.id },
  ];

  const customers: Record<string, string> = {}; // ref -> id
  for (const c of customerData) {
    const customer = await prisma.customer.upsert({
      where: { customerRef: c.ref },
      create: {
        customerRef: c.ref,
        email: c.email,
        fullName: c.fullName,
        phone: c.phone,
        branchId: c.branchId,
        isActive: true,
        activatedAt: new Date(),
      },
      update: {},
    });
    customers[c.ref] = customer.id;
  }
  console.log('Customers OK');

  // Ensure invoice sequence exists
  await prisma.$executeRawUnsafe(
    `CREATE SEQUENCE IF NOT EXISTS karrkarr_invoice_seq START 1 INCREMENT 1`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE SEQUENCE IF NOT EXISTS karrkarr_receipt_seq START 1 INCREMENT 1`,
  );

  // ── Rentals + Invoices ──────────────────────────────────────────────────────
  // We create a representative mix of rental scenarios

  interface RentalScenario {
    agreementNo: string;
    customerRef: string;
    plate: string;
    billingFrequency: BillingFrequency;
    billingAnchorDay: number;
    startDate: Date;
    endDate: Date;
    rentAmountCents: bigint;
    depositCents: bigint;
    invoiceStatus: InvoiceStatus;
    invoiceDueDaysAgo: number; // positive = overdue
    interestDaysToAccrue?: number;
  }

  const scenarios: RentalScenario[] = [
    // Healthy, upcoming invoice
    { agreementNo: 'KR-R-2026-00001', customerRef: 'KR-C-00001', plate: 'SMR1337G', billingFrequency: 'MONTHLY', billingAnchorDay: 1, startDate: daysAgo(60), endDate: daysFromNow(300), rentAmountCents: 200000n, depositCents: 400000n, invoiceStatus: 'DUE', invoiceDueDaysAgo: 0 },
    // Due today
    { agreementNo: 'KR-R-2026-00002', customerRef: 'KR-C-00002', plate: 'SNA2288B', billingFrequency: 'WEEKLY', billingAnchorDay: 4, startDate: daysAgo(28), endDate: daysFromNow(60), rentAmountCents: 58000n, depositCents: 116000n, invoiceStatus: 'DUE', invoiceDueDaysAgo: 0 },
    // 3 days overdue (within grace, no interest yet)
    { agreementNo: 'KR-R-2026-00003', customerRef: 'KR-C-00003', plate: 'SKA5512T', billingFrequency: 'MONTHLY', billingAnchorDay: 15, startDate: daysAgo(45), endDate: daysFromNow(320), rentAmountCents: 185000n, depositCents: 370000n, invoiceStatus: 'OVERDUE', invoiceDueDaysAgo: 3 },
    // 5 days overdue (within grace)
    { agreementNo: 'KR-R-2026-00004', customerRef: 'KR-C-00004', plate: 'SBK3301H', billingFrequency: 'WEEKLY', billingAnchorDay: 2, startDate: daysAgo(35), endDate: daysFromNow(150), rentAmountCents: 210000n, depositCents: 420000n, invoiceStatus: 'OVERDUE', invoiceDueDaysAgo: 5 },
    // 7 days overdue WITH interest (7-3=4 days of interest)
    { agreementNo: 'KR-R-2026-00005', customerRef: 'KR-C-00005', plate: 'SDK7745U', billingFrequency: 'MONTHLY', billingAnchorDay: 1, startDate: daysAgo(38), endDate: daysFromNow(330), rentAmountCents: 230000n, depositCents: 460000n, invoiceStatus: 'OVERDUE', invoiceDueDaysAgo: 7, interestDaysToAccrue: 4 },
    // 1 day overdue (just crossed grace=3, no interest yet)
    { agreementNo: 'KR-R-2026-00006', customerRef: 'KR-C-00006', plate: 'SFM2203C', billingFrequency: 'WEEKLY', billingAnchorDay: 5, startDate: daysAgo(22), endDate: daysFromNow(70), rentAmountCents: 200000n, depositCents: 400000n, invoiceStatus: 'OVERDUE', invoiceDueDaysAgo: 1 },
    // 20+ days overdue WITH significant interest
    { agreementNo: 'KR-R-2026-00007', customerRef: 'KR-C-00007', plate: 'SGP4456K', billingFrequency: 'MONTHLY', billingAnchorDay: 10, startDate: daysAgo(50), endDate: daysFromNow(310), rentAmountCents: 220000n, depositCents: 440000n, invoiceStatus: 'OVERDUE', invoiceDueDaysAgo: 23, interestDaysToAccrue: 20 },
    // 25 days overdue
    { agreementNo: 'KR-R-2026-00008', customerRef: 'KR-C-00008', plate: 'SHA3389P', billingFrequency: 'MONTHLY', billingAnchorDay: 5, startDate: daysAgo(56), endDate: daysFromNow(290), rentAmountCents: 190000n, depositCents: 380000n, invoiceStatus: 'OVERDUE', invoiceDueDaysAgo: 25, interestDaysToAccrue: 22 },
    // Partially paid
    { agreementNo: 'KR-R-2026-00009', customerRef: 'KR-C-00009', plate: 'SNF2278E', billingFrequency: 'MONTHLY', billingAnchorDay: 20, startDate: daysAgo(40), endDate: daysFromNow(320), rentAmountCents: 240000n, depositCents: 480000n, invoiceStatus: 'PARTIALLY_PAID', invoiceDueDaysAgo: 10, interestDaysToAccrue: 7 },
    // Pending verification
    { agreementNo: 'KR-R-2026-00010', customerRef: 'KR-C-00010', plate: 'SPG3314R', billingFrequency: 'WEEKLY', billingAnchorDay: 1, startDate: daysAgo(21), endDate: daysFromNow(60), rentAmountCents: 195000n, depositCents: 390000n, invoiceStatus: 'PENDING_VERIFICATION', invoiceDueDaysAgo: 4 },
    // Paid
    { agreementNo: 'KR-R-2026-00011', customerRef: 'KR-C-00011', plate: 'SQH4456Y', billingFrequency: 'MONTHLY', billingAnchorDay: 1, startDate: daysAgo(45), endDate: daysFromNow(315), rentAmountCents: 230000n, depositCents: 460000n, invoiceStatus: 'PAID', invoiceDueDaysAgo: -5 },
    // Upcoming
    { agreementNo: 'KR-R-2026-00012', customerRef: 'KR-C-00012', plate: 'SRK5523B', billingFrequency: 'WEEKLY', billingAnchorDay: 3, startDate: daysAgo(10), endDate: daysFromNow(80), rentAmountCents: 188000n, depositCents: 376000n, invoiceStatus: 'UPCOMING', invoiceDueDaysAgo: -7 },
  ];

  for (const s of scenarios) {
    const customerId = customers[s.customerRef];
    const vehicleId = vehicles[s.plate];
    if (!customerId || !vehicleId) {
      console.warn(`Skipping ${s.agreementNo}: missing customer or vehicle`);
      continue;
    }

    const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId }, select: { branchId: true } });

    // Upsert rental
    const rental = await prisma.rentalAgreement.upsert({
      where: { agreementNo: s.agreementNo },
      create: {
        agreementNo: s.agreementNo,
        customerId,
        vehicleId,
        branchId: vehicle.branchId,
        status: 'ACTIVE',
        startDate: s.startDate,
        endDate: s.endDate,
        billingFrequency: s.billingFrequency,
        billingAnchorDay: s.billingAnchorDay,
        rentAmountCents: s.rentAmountCents,
        depositRequiredCents: s.depositCents,
        depositPaidCents: s.depositCents,
        depositBalanceCents: s.depositCents,
        accidentExcessCents: 200000n,
        interestRateBpsOverride: null,
        signedAt: s.startDate,
      },
      update: {},
    });

    // Issue deposit ledger entry
    const depositKey = `seed:deposit:${rental.id}`;
    const existingDeposit = await prisma.ledgerEntry.findUnique({ where: { idempotencyKey: depositKey } });
    if (!existingDeposit) {
      const lastEntry = await prisma.ledgerEntry.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        select: { balanceAfterCents: true },
      });
      const prevBalance = lastEntry?.balanceAfterCents ?? 0n;
      await prisma.ledgerEntry.create({
        data: {
          customerId,
          rentalAgreementId: rental.id,
          type: 'DEPOSIT_RECEIVED',
          amountCents: -s.depositCents,
          balanceAfterCents: prevBalance - s.depositCents,
          description: `Deposit received for ${s.agreementNo}`,
          effectiveDate: s.startDate,
          idempotencyKey: depositKey,
          createdBy: null,
        },
      });
    }

    // Create invoice
    const invoiceNo = await prisma.$queryRaw<[{ nextval: bigint }]>(
      Prisma.sql`SELECT nextval('karrkarr_invoice_seq')`,
    ).then((r: [{ nextval: bigint }]) => `KR-INV-2026-${Number(r[0].nextval).toString().padStart(6, '0')}`);

    const dueDate = daysAgo(s.invoiceDueDaysAgo);
    const issueDate = new Date(dueDate.getTime() - 7 * 86_400_000);
    const periodEnd = issueDate;
    const periodStart = new Date(periodEnd.getTime() - (s.billingFrequency === 'WEEKLY' ? 6 : 29) * 86_400_000);

    const existingInvoice = await prisma.invoice.findFirst({
      where: { rentalAgreementId: rental.id, status: { not: 'CANCELLED' } },
    });

    let invoiceId: string;
    if (existingInvoice) {
      invoiceId = existingInvoice.id;
    } else {
      const inv = await prisma.invoice.create({
        data: {
          invoiceNo,
          rentalAgreementId: rental.id,
          customerId,
          branchId: vehicle.branchId,
          status: s.invoiceStatus,
          periodStart,
          periodEnd,
          issueDate,
          dueDate,
          principalCents: s.rentAmountCents,
          outstandingCents: s.invoiceStatus === 'PAID' ? 0n : s.invoiceStatus === 'PARTIALLY_PAID' ? s.rentAmountCents / 2n : s.rentAmountCents,
          appliedInterestRateBps: 100,
          appliedGracePeriodDays: 3,
          ...(s.invoiceStatus === 'PAID' ? { paidAt: daysAgo(2) } : {}),
        },
      });
      invoiceId = inv.id;

      // Write RENTAL_CHARGE ledger entry
      const chargeKey = `seed:charge:${invoiceId}`;
      const existingCharge = await prisma.ledgerEntry.findUnique({ where: { idempotencyKey: chargeKey } });
      if (!existingCharge) {
        const last2 = await prisma.ledgerEntry.findFirst({
          where: { customerId },
          orderBy: { createdAt: 'desc' },
          select: { balanceAfterCents: true },
        });
        const prevBal = last2?.balanceAfterCents ?? 0n;
        await prisma.ledgerEntry.create({
          data: {
            customerId,
            rentalAgreementId: rental.id,
            invoiceId,
            type: 'RENTAL_CHARGE',
            amountCents: s.rentAmountCents,
            balanceAfterCents: prevBal + s.rentAmountCents,
            description: `Rental charge: ${invoiceNo}`,
            effectiveDate: issueDate,
            idempotencyKey: chargeKey,
          },
        });
      }

      // Write LATE_INTEREST entries if needed
      if (s.interestDaysToAccrue && s.interestDaysToAccrue > 0) {
        const firstDate = new Date(dueDate.getTime() + (3 + 1) * 86_400_000); // grace=3
        for (let d = 0; d < s.interestDaysToAccrue; d++) {
          const accrualDate = new Date(firstDate.getTime() + d * 86_400_000);
          const key = `interest:${invoiceId}:${isoDate(accrualDate)}`;
          const existingInterest = await prisma.ledgerEntry.findUnique({ where: { idempotencyKey: key } });
          if (!existingInterest) {
            const charge = BigInt(Math.round(Number(s.rentAmountCents) * 100 / 10000)); // 1%/day
            const lastInt = await prisma.ledgerEntry.findFirst({
              where: { customerId },
              orderBy: { createdAt: 'desc' },
              select: { balanceAfterCents: true },
            });
            await prisma.ledgerEntry.create({
              data: {
                customerId,
                rentalAgreementId: rental.id,
                invoiceId,
                type: 'LATE_INTEREST',
                amountCents: charge,
                balanceAfterCents: (lastInt?.balanceAfterCents ?? 0n) + charge,
                description: `Late interest for ${isoDate(accrualDate)}`,
                effectiveDate: accrualDate,
                idempotencyKey: key,
              },
            });
          }
        }

        // Update invoice caches
        const interestAgg = await prisma.ledgerEntry.aggregate({
          where: { invoiceId, type: 'LATE_INTEREST' },
          _sum: { amountCents: true },
        });
        const totalInterest = interestAgg._sum.amountCents ?? 0n;
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            interestAccruedCents: totalInterest,
            outstandingCents: s.rentAmountCents + totalInterest - (s.invoiceStatus === 'PARTIALLY_PAID' ? s.rentAmountCents / 2n : 0n),
            lastInterestAccrualDate: daysAgo(3),
          },
        });
      }

      // PARTIALLY_PAID: write a partial payment
      if (s.invoiceStatus === 'PARTIALLY_PAID') {
        const partialKey = `seed:partial_payment:${invoiceId}`;
        const existing = await prisma.ledgerEntry.findUnique({ where: { idempotencyKey: partialKey } });
        if (!existing) {
          const last3 = await prisma.ledgerEntry.findFirst({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
            select: { balanceAfterCents: true },
          });
          const paid = s.rentAmountCents / 2n;
          await prisma.ledgerEntry.create({
            data: {
              customerId,
              rentalAgreementId: rental.id,
              invoiceId,
              type: 'PAYMENT_RECEIVED',
              amountCents: -paid,
              balanceAfterCents: (last3?.balanceAfterCents ?? 0n) - paid,
              description: `Partial payment on ${invoiceNo}`,
              effectiveDate: daysAgo(8),
              idempotencyKey: partialKey,
            },
          });
        }
      }

      // PAID: write full payment
      if (s.invoiceStatus === 'PAID') {
        const paidKey = `seed:payment:${invoiceId}`;
        const existing = await prisma.ledgerEntry.findUnique({ where: { idempotencyKey: paidKey } });
        if (!existing) {
          const last4 = await prisma.ledgerEntry.findFirst({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
            select: { balanceAfterCents: true },
          });
          await prisma.ledgerEntry.create({
            data: {
              customerId,
              rentalAgreementId: rental.id,
              invoiceId,
              type: 'PAYMENT_RECEIVED',
              amountCents: -s.rentAmountCents,
              balanceAfterCents: (last4?.balanceAfterCents ?? 0n) - s.rentAmountCents,
              description: `Payment received for ${invoiceNo}`,
              effectiveDate: daysAgo(2),
              idempotencyKey: paidKey,
            },
          });
        }
      }
    }
  }

  console.log('Rentals + invoices OK');

  // Update vehicle statuses to RENTED_OUT for active rentals
  await prisma.$executeRaw`
    UPDATE "Vehicle" v
    SET status = 'RENTED_OUT'
    WHERE v.id IN (
      SELECT "vehicleId" FROM "RentalAgreement" WHERE status IN ('ACTIVE', 'ENDING_SOON')
    )
    AND v.status = 'AVAILABLE'
  `;

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
