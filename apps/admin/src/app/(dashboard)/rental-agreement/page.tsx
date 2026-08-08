'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RentalSummary {
  id: string;
  agreementNo: string;
  customerName: string;
  plateNumber: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface RentalDetail {
  id: string;
  agreementNo: string;
  customerName: string;
  customerNric?: string;
  customerAddress?: string;
  customerPhone?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  plateNumber: string;
  startDate: string;
  endDate: string;
  rentAmountCents: number;
  billingFrequency: 'WEEKLY' | 'MONTHLY';
  depositRequiredCents: number;
  depositPaidCents?: number;
}

interface Paginated {
  data: RentalSummary[];
  total: number;
}

type PurposeType = 'personal' | 'private_hire' | 'others';
type BillingFreq = 'WEEKLY' | 'MONTHLY';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toInputDate(iso: string): string {
  if (!iso) return '';
  return iso.split('T')[0];
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-2xs font-medium text-zinc-400 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors';

const textareaClass =
  'w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors resize-none';

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-px flex-1 bg-zinc-800" />
      <span className="text-2xs font-semibold text-teal-400 uppercase tracking-widest whitespace-nowrap">{title}</span>
      <div className="h-px flex-1 bg-zinc-800" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Terms pages (static)
// ---------------------------------------------------------------------------

const TERMS_TEXT = `TERMS AND CONDITIONS

1. PERIOD OF HIRE
1.1 The period of hire shall commence on the Commencement Date and shall continue for the period specified in the Rental Payment Details section of this Agreement, unless earlier terminated in accordance with the terms herein.
1.2 The Hirer shall return the Vehicle to the Owner on the expiry of the Period of Hire in the same condition as when it was delivered to the Hirer, fair wear and tear excepted.
1.3 If the Hirer fails to return the Vehicle by the expiry of the Period of Hire, the Hirer shall pay the Owner additional rental at the daily rate equivalent to the agreed rental rate for each day or part thereof that the Vehicle is retained beyond the Period of Hire.

2. RENTAL AND DEPOSIT
2.1 The Hirer shall pay the Rental Amount to the Owner in advance on the Due Day of each billing period as specified in this Agreement.
2.2 The Security Deposit shall be paid by the Hirer to the Owner upon signing of this Agreement. The Security Deposit shall be held by the Owner as security for the due performance of the Hirer's obligations under this Agreement.
2.3 The Security Deposit shall be refunded to the Hirer within fourteen (14) days of the expiry or termination of this Agreement, less any amounts owed by the Hirer to the Owner.
2.4 No interest shall be payable on the Security Deposit.

3. USE OF VEHICLE
3.1 The Hirer shall use the Vehicle only for the purpose specified in this Agreement and shall not use the Vehicle for any illegal purpose or in any manner that would invalidate any insurance policy relating to the Vehicle.
3.2 The Hirer shall not sub-let, hire, lend or part with possession of the Vehicle without the prior written consent of the Owner.
3.3 The Hirer shall not permit any person other than the named Relief Driver (if any) to drive the Vehicle without the prior written consent of the Owner.
3.4 The Hirer shall comply with all traffic and other laws, regulations and by-laws applicable to the use of the Vehicle.
3.5 The Hirer shall not take the Vehicle out of Singapore without the prior written consent of the Owner.

4. MAINTENANCE AND REPAIRS
4.1 The Owner shall be responsible for maintaining the Vehicle in a roadworthy condition and shall carry out all scheduled servicing at the Owner's cost.
4.2 The Hirer shall be responsible for the daily maintenance of the Vehicle including checking and maintaining oil levels, water, tyre pressure and other fluid levels.
4.3 The Hirer shall immediately report to the Owner any defect, damage or breakdown of the Vehicle.
4.4 The Hirer shall not carry out or authorise any repairs or modifications to the Vehicle without the prior written consent of the Owner.

5. INSURANCE
5.1 The Owner shall maintain a valid motor insurance policy covering the Vehicle for the duration of this Agreement.
5.2 The Hirer shall be liable for the insurance excess in the event of any accident, damage or loss involving the Vehicle, whether or not the Hirer is at fault.
5.3 The Hirer shall promptly notify the Owner and the relevant authorities of any accident, damage, theft or loss involving the Vehicle.

6. ACCIDENT AND DAMAGE
6.1 In the event of an accident involving the Vehicle, the Hirer shall:
   (a) Not admit liability or make any payment without the Owner's prior written consent;
   (b) Obtain the names, addresses and vehicle registration numbers of all parties involved;
   (c) Report the accident to the police if required by law;
   (d) Notify the Owner within 24 hours of the accident;
   (e) Complete and submit all accident report forms as required by the Owner.
6.2 The Hirer shall be liable for all damage to the Vehicle caused by the Hirer's negligence or misuse.

7. TERMINATION
7.1 Either party may terminate this Agreement by giving not less than one (1) month's written notice to the other party.
7.2 The Owner may terminate this Agreement immediately without notice if:
   (a) The Hirer fails to pay any rental when due and such failure continues for more than seven (7) days after written notice from the Owner;
   (b) The Hirer breaches any material term of this Agreement and fails to remedy such breach within seven (7) days of written notice from the Owner;
   (c) The Hirer becomes insolvent, bankrupt or enters into any arrangement with its creditors;
   (d) The Vehicle is used for any illegal purpose.
7.3 Upon termination, the Hirer shall immediately return the Vehicle to the Owner in the condition required by this Agreement.

8. LIABILITY
8.1 The Owner shall not be liable for any loss, damage, injury or death arising from or in connection with the use of the Vehicle by the Hirer or any other person.
8.2 The Hirer shall indemnify and keep indemnified the Owner against all claims, losses, damages, costs and expenses arising from or in connection with the use of the Vehicle by the Hirer.

9. GENERAL
9.1 This Agreement constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior agreements, understandings, negotiations and discussions, whether oral or written.
9.2 This Agreement shall be governed by and construed in accordance with the laws of Singapore.
9.3 Any dispute arising out of or in connection with this Agreement shall be subject to the exclusive jurisdiction of the courts of Singapore.
9.4 Any amendment to this Agreement shall be in writing and signed by both parties.
9.5 If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.
9.6 The failure of either party to enforce any provision of this Agreement shall not be construed as a waiver of that party's right to enforce such provision at any later time.

10. TRAFFIC OFFENCES
10.1 The Hirer shall be solely responsible for all traffic offences, parking fines, ERP charges, and other penalties incurred during the Period of Hire.
10.2 The Hirer authorises the Owner to provide the Hirer's particulars to the relevant authorities in connection with any such offences.
10.3 If the Owner receives any notice in respect of a traffic offence committed during the Period of Hire, the Owner shall forward such notice to the Hirer who shall deal with it directly.
10.4 An administrative charge of S$50 shall be payable by the Hirer to the Owner for each traffic offence notice received by the Owner in respect of the Vehicle during the Period of Hire.

11. RETURN OF VEHICLE
11.1 The Hirer shall return the Vehicle to the Owner's premises at 7 Sin Ming Industrial Estate Sector C, #01-94, Singapore 575642 at the expiry of the Period of Hire or upon termination of this Agreement.
11.2 The Vehicle shall be returned in a clean condition and with a full tank of fuel (if applicable).
11.3 Any personal belongings left in the Vehicle at the time of return shall be at the Hirer's own risk and the Owner shall not be liable for any loss or damage to such items.

12. ACKNOWLEDGEMENT
The Hirer acknowledges that he/she has read, understood and agrees to be bound by the terms and conditions of this Agreement, including all the terms set out herein.`;

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function RentalAgreementPage() {
  // Rental list
  const [rentals, setRentals] = useState<RentalSummary[]>([]);
  const [loadingRentals, setLoadingRentals] = useState(true);
  const [selectedRentalId, setSelectedRentalId] = useState('');
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Hirer fields
  const [hirerName, setHirerName] = useState('');
  const [hirerNric, setHirerNric] = useState('');
  const [hirerAddress, setHirerAddress] = useState('');
  const [hirerContact, setHirerContact] = useState('');

  // Relief driver
  const [showRelief, setShowRelief] = useState(false);
  const [reliefName, setReliefName] = useState('');
  const [reliefNric, setReliefNric] = useState('');
  const [reliefAddress, setReliefAddress] = useState('');
  const [reliefContact, setReliefContact] = useState('');

  // Vehicle
  const [makeModel, setMakeModel] = useState('');
  const [regNo, setRegNo] = useState('');

  // Payment
  const [contractDate, setContractDate] = useState('');
  const [commencementDate, setCommencementDate] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [rentalAmount, setRentalAmount] = useState('');
  const [billingFreq, setBillingFreq] = useState<BillingFreq>('MONTHLY');
  const [numMonths, setNumMonths] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('');

  // Purpose
  const [purpose, setPurpose] = useState<PurposeType>('personal');
  const [purposeOther, setPurposeOther] = useState('');

  // ------- Load rental list -------
  useEffect(() => {
    setLoadingRentals(true);
    apiGet<Paginated>('/rentals', { pageSize: 200, status: 'ACTIVE' })
      .then(res => setRentals(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingRentals(false));
  }, []);

  // ------- Auto-fill when rental selected -------
  const handleSelectRental = useCallback(async (id: string) => {
    setSelectedRentalId(id);
    if (!id) return;
    setLoadingDetail(true);
    try {
      const detail = await apiGet<RentalDetail>(`/rentals/${id}`);
      setHirerName(detail.customerName ?? '');
      setHirerNric(detail.customerNric ?? '');
      setHirerAddress(detail.customerAddress ?? '');
      setHirerContact(detail.customerPhone ?? '');
      const make = detail.vehicleMake ?? '';
      const model = detail.vehicleModel ?? '';
      setMakeModel(make && model ? `${make} ${model}` : make || model);
      setRegNo(detail.plateNumber ?? '');
      setCommencementDate(toInputDate(detail.startDate));
      setPeriodFrom(toInputDate(detail.startDate));
      setPeriodTo(toInputDate(detail.endDate));
      setRentalAmount(detail.rentAmountCents ? String(detail.rentAmountCents / 100) : '');
      setBillingFreq(detail.billingFrequency ?? 'MONTHLY');
      setSecurityDeposit(detail.depositRequiredCents ? String(detail.depositRequiredCents / 100) : '');
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // ------- Generate PDF -------
  function handleGeneratePdf() {
    window.print();
  }

  // ------- Format date for display -------
  function fmtDate(val: string) {
    if (!val) return '___________________';
    try {
      return new Date(val).toLocaleDateString('en-SG', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return val;
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <>
      {/* ================================================================
          PRINT STYLES — only the printable area is shown when printing
      ================================================================ */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable-agreement, #printable-agreement * { visibility: visible !important; }
          #printable-agreement {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
          }
          @page {
            size: A4;
            margin: 15mm 18mm;
          }
        }

        /* Screen: hide the printable area */
        @media screen {
          #printable-agreement { display: none; }
        }
      `}</style>

      {/* ================================================================
          ADMIN UI FORM (screen only)
      ================================================================ */}
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Page header */}
        <div>
          <h1 className="text-base font-semibold text-zinc-100">Rental Agreement Generator</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Fill in the details below and click Generate PDF to produce a printable rental agreement.</p>
        </div>

        {/* Rental picker */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
          <SectionHeader title="Load From Rental" />
          <LabeledField label="Select Rental (auto-fill)">
            <select
              value={selectedRentalId}
              onChange={e => handleSelectRental(e.target.value)}
              disabled={loadingRentals}
              className={inputClass}
            >
              <option value="">{loadingRentals ? 'Loading rentals…' : '— Select a rental —'}</option>
              {rentals.map(r => (
                <option key={r.id} value={r.id}>
                  {r.agreementNo} · {r.customerName} · {r.plateNumber}
                </option>
              ))}
            </select>
          </LabeledField>
          {loadingDetail && (
            <p className="text-2xs text-teal-400 animate-pulse">Loading rental details…</p>
          )}
        </div>

        {/* Hirer Information */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
          <SectionHeader title="Hirer Information" />
          <div className="grid grid-cols-2 gap-3">
            <LabeledField label="Hirer Name">
              <input type="text" className={inputClass} value={hirerName} onChange={e => setHirerName(e.target.value)} placeholder="Full legal name" />
            </LabeledField>
            <LabeledField label="Hirer NRIC">
              <input type="text" className={inputClass} value={hirerNric} onChange={e => setHirerNric(e.target.value)} placeholder="S1234567A" />
            </LabeledField>
          </div>
          <LabeledField label="Hirer Address">
            <textarea className={textareaClass} rows={2} value={hirerAddress} onChange={e => setHirerAddress(e.target.value)} placeholder="Full address" />
          </LabeledField>
          <div className="grid grid-cols-2 gap-3">
            <LabeledField label="Hirer Contact No.">
              <input type="text" className={inputClass} value={hirerContact} onChange={e => setHirerContact(e.target.value)} placeholder="+65 9xxx xxxx" />
            </LabeledField>
          </div>
        </div>

        {/* Relief Driver */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeader title="Relief Driver (Optional)" />
            <button
              type="button"
              onClick={() => setShowRelief(v => !v)}
              className="text-2xs text-teal-400 hover:text-teal-300 border border-teal-800 rounded px-2 py-0.5 transition-colors mb-3"
            >
              {showRelief ? 'Collapse' : 'Expand'}
            </button>
          </div>
          {showRelief && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <LabeledField label="Relief Driver Name">
                  <input type="text" className={inputClass} value={reliefName} onChange={e => setReliefName(e.target.value)} placeholder="Full legal name" />
                </LabeledField>
                <LabeledField label="Relief Driver NRIC">
                  <input type="text" className={inputClass} value={reliefNric} onChange={e => setReliefNric(e.target.value)} placeholder="S1234567A" />
                </LabeledField>
              </div>
              <LabeledField label="Relief Driver Address">
                <textarea className={textareaClass} rows={2} value={reliefAddress} onChange={e => setReliefAddress(e.target.value)} placeholder="Full address" />
              </LabeledField>
              <div className="grid grid-cols-2 gap-3">
                <LabeledField label="Relief Driver Contact No.">
                  <input type="text" className={inputClass} value={reliefContact} onChange={e => setReliefContact(e.target.value)} placeholder="+65 9xxx xxxx" />
                </LabeledField>
              </div>
            </div>
          )}
        </div>

        {/* Vehicle Details */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
          <SectionHeader title="Vehicle Details" />
          <div className="grid grid-cols-2 gap-3">
            <LabeledField label="Make / Model">
              <input type="text" className={inputClass} value={makeModel} onChange={e => setMakeModel(e.target.value)} placeholder="Toyota Vios 1.5A" />
            </LabeledField>
            <LabeledField label="Vehicle Registration No.">
              <input type="text" className={inputClass} value={regNo} onChange={e => setRegNo(e.target.value)} placeholder="SMR1337G" />
            </LabeledField>
          </div>
        </div>

        {/* Rental Payment Details */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
          <SectionHeader title="Rental Payment Details" />
          <div className="grid grid-cols-2 gap-3">
            <LabeledField label="Contract Date">
              <input type="date" className={inputClass} value={contractDate} onChange={e => setContractDate(e.target.value)} />
            </LabeledField>
            <LabeledField label="Commencement Date">
              <input type="date" className={inputClass} value={commencementDate} onChange={e => setCommencementDate(e.target.value)} />
            </LabeledField>
            <LabeledField label="Period of Hire From">
              <input type="date" className={inputClass} value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} />
            </LabeledField>
            <LabeledField label="Period of Hire To">
              <input type="date" className={inputClass} value={periodTo} onChange={e => setPeriodTo(e.target.value)} />
            </LabeledField>
            <LabeledField label="Rental Amount (SGD)">
              <input type="number" className={inputClass} value={rentalAmount} onChange={e => setRentalAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" />
            </LabeledField>
            <LabeledField label="Security Deposit (SGD)">
              <input type="number" className={inputClass} value={securityDeposit} onChange={e => setSecurityDeposit(e.target.value)} placeholder="0.00" min="0" step="0.01" />
            </LabeledField>
            <LabeledField label="Number of Months">
              <input type="number" className={inputClass} value={numMonths} onChange={e => setNumMonths(e.target.value)} placeholder="12" min="1" />
            </LabeledField>
            <LabeledField label="Due Day">
              <input type="text" className={inputClass} value={dueDay} onChange={e => setDueDay(e.target.value)} placeholder="Monday or 1st" />
            </LabeledField>
          </div>
          <LabeledField label="Billing Frequency">
            <div className="flex gap-4 pt-0.5">
              {(['WEEKLY', 'MONTHLY'] as BillingFreq[]).map(f => (
                <label key={f} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="billingFreq"
                    value={f}
                    checked={billingFreq === f}
                    onChange={() => setBillingFreq(f)}
                    className="accent-teal-500"
                  />
                  <span className="text-xs text-zinc-300">{f === 'WEEKLY' ? 'Weekly' : 'Monthly'}</span>
                </label>
              ))}
            </div>
          </LabeledField>
        </div>

        {/* Purpose of Renting */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
          <SectionHeader title="Purpose of Renting" />
          <div className="flex gap-4">
            {(['personal', 'private_hire', 'others'] as PurposeType[]).map(p => (
              <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="purpose"
                  value={p}
                  checked={purpose === p}
                  onChange={() => setPurpose(p)}
                  className="accent-teal-500"
                />
                <span className="text-xs text-zinc-300">
                  {p === 'personal' ? 'Personal Usage' : p === 'private_hire' ? 'Private Hire Usage' : 'Others'}
                </span>
              </label>
            ))}
          </div>
          {purpose === 'others' && (
            <LabeledField label="Please Specify">
              <input type="text" className={inputClass} value={purposeOther} onChange={e => setPurposeOther(e.target.value)} placeholder="Describe purpose" />
            </LabeledField>
          )}
        </div>

        {/* Generate button */}
        <div className="flex justify-end pb-8">
          <button
            type="button"
            onClick={handleGeneratePdf}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold px-4 py-2 rounded transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
              <path d="M3 2h9a1 1 0 011 1v9l-3 3H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" />
              <path d="M10 2v3h3M5 7h5M5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Generate PDF
          </button>
        </div>
      </div>

      {/* ================================================================
          PRINTABLE AGREEMENT (hidden on screen, shown when printing)
      ================================================================ */}
      <div id="printable-agreement">
        <style>{`
          #printable-agreement {
            font-family: 'Times New Roman', Times, serif;
            font-size: 10pt;
            color: #000;
            background: #fff;
          }
          .page { page-break-after: always; padding: 0; }
          .page:last-child { page-break-after: avoid; }
          .agreement-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20pt; }
          .agreement-title { text-align: center; font-size: 14pt; font-weight: bold; letter-spacing: 1px; margin: 10pt 0 16pt; border-bottom: 2px solid #000; padding-bottom: 8pt; }
          .section-title { font-size: 10pt; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 3pt; margin: 12pt 0 6pt; letter-spacing: 0.5px; }
          .field-row { display: flex; gap: 20pt; margin-bottom: 6pt; }
          .field-row.single { display: block; }
          .field-item { flex: 1; }
          .field-label { font-size: 8.5pt; color: #444; margin-bottom: 1pt; }
          .field-value { font-size: 10pt; border-bottom: 1px solid #888; min-height: 16pt; padding: 1pt 2pt; }
          .field-value.multiline { min-height: 28pt; }
          .checkbox-row { display: flex; gap: 24pt; margin: 6pt 0; }
          .checkbox-item { display: flex; align-items: center; gap: 5pt; }
          .cb { width: 10pt; height: 10pt; border: 1.5px solid #000; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .cb.checked::before { content: '✓'; font-size: 8pt; }
          .signature-block { display: flex; gap: 30pt; margin-top: 36pt; }
          .sig-item { flex: 1; border-top: 1px solid #000; padding-top: 4pt; font-size: 9pt; }
          .terms-section { font-size: 9pt; line-height: 1.55; white-space: pre-wrap; }
          .company-address { font-size: 8.5pt; text-align: right; color: #333; line-height: 1.4; }
          .company-name-print { font-size: 13pt; font-weight: bold; letter-spacing: 0.5px; }
          table.details { width: 100%; border-collapse: collapse; margin-bottom: 6pt; }
          table.details td { padding: 3pt 4pt; vertical-align: top; font-size: 10pt; }
          table.details td:first-child { width: 38%; font-size: 8.5pt; color: #444; }
          table.details td:last-child { border-bottom: 1px solid #888; }
          .page-num { text-align: right; font-size: 8pt; color: #666; margin-top: 6pt; }
        `}</style>

        {/* ---- PAGE 1: Agreement ---- */}
        <div className="page">
          {/* Header */}
          <div className="agreement-header">
            <div>
              <div className="company-name-print">Karrkarr Rental Pte. Ltd.</div>
            </div>
            <div className="company-address">
              7 Sin Ming Industrial Estate Sector C<br />
              #01-94 Singapore 575642<br />
              kkrental.sg@gmail.com
            </div>
          </div>

          <div className="agreement-title">VEHICLE RENTAL AGREEMENT</div>

          {/* Owner */}
          <div className="section-title">Owner</div>
          <table className="details">
            <tbody>
              <tr><td>Name</td><td>Karrkarr Rental Pte. Ltd.</td></tr>
              <tr><td>ROC No.</td><td>201917017W</td></tr>
              <tr><td>Address</td><td>7 Sin Ming Industrial Estate Sector C, #01-94 Singapore 575642</td></tr>
            </tbody>
          </table>

          {/* Hirer */}
          <div className="section-title">Hirer</div>
          <table className="details">
            <tbody>
              <tr><td>Name</td><td>{hirerName || ' '}</td></tr>
              <tr><td>NRIC No.</td><td>{hirerNric || ' '}</td></tr>
              <tr><td>Address</td><td>{hirerAddress || ' '}</td></tr>
              <tr><td>Contact No.</td><td>{hirerContact || ' '}</td></tr>
            </tbody>
          </table>

          {/* Relief Driver */}
          <div className="section-title">Relief Driver (if applicable)</div>
          <table className="details">
            <tbody>
              <tr><td>Name</td><td>{reliefName || ' '}</td></tr>
              <tr><td>NRIC No.</td><td>{reliefNric || ' '}</td></tr>
              <tr><td>Address</td><td>{reliefAddress || ' '}</td></tr>
              <tr><td>Contact No.</td><td>{reliefContact || ' '}</td></tr>
            </tbody>
          </table>

          {/* Vehicle */}
          <div className="section-title">Description of Vehicle</div>
          <table className="details">
            <tbody>
              <tr><td>Make / Model</td><td>{makeModel || ' '}</td></tr>
              <tr><td>Vehicle Registration No.</td><td>{regNo || ' '}</td></tr>
            </tbody>
          </table>

          {/* Rental Payment Details */}
          <div className="section-title">Rental Payment Details</div>
          <table className="details">
            <tbody>
              <tr><td>Contract Date</td><td>{fmtDate(contractDate)}</td></tr>
              <tr><td>Commencement Date</td><td>{fmtDate(commencementDate)}</td></tr>
              <tr><td>Period of Hire</td><td>{fmtDate(periodFrom)} to {fmtDate(periodTo)}</td></tr>
              <tr><td>Rental Amount</td><td>SGD {rentalAmount || '___________'}</td></tr>
              <tr>
                <td>Billing Frequency</td>
                <td>
                  <div className="checkbox-row">
                    <div className="checkbox-item">
                      <div className={`cb${billingFreq === 'WEEKLY' ? ' checked' : ''}`} />
                      <span>Weekly</span>
                    </div>
                    <div className="checkbox-item">
                      <div className={`cb${billingFreq === 'MONTHLY' ? ' checked' : ''}`} />
                      <span>Monthly</span>
                    </div>
                  </div>
                </td>
              </tr>
              <tr><td>Number of Months</td><td>{numMonths || ' '}</td></tr>
              <tr><td>Due Day</td><td>{dueDay || ' '}</td></tr>
              <tr><td>Security Deposit</td><td>SGD {securityDeposit || '___________'}</td></tr>
            </tbody>
          </table>

          {/* Purpose */}
          <div className="section-title">Purpose of Renting</div>
          <div className="checkbox-row">
            <div className="checkbox-item">
              <div className={`cb${purpose === 'personal' ? ' checked' : ''}`} />
              <span>Personal Usage</span>
            </div>
            <div className="checkbox-item">
              <div className={`cb${purpose === 'private_hire' ? ' checked' : ''}`} />
              <span>Private Hire Usage</span>
            </div>
            <div className="checkbox-item">
              <div className={`cb${purpose === 'others' ? ' checked' : ''}`} />
              <span>Others{purpose === 'others' && purposeOther ? `: ${purposeOther}` : ''}</span>
            </div>
          </div>

          {/* Signatures — Page 1 */}
          <div className="signature-block">
            <div className="sig-item">
              <div style={{marginBottom: '28pt'}}>Owner Signature</div>
              <div>Name: Karrkarr Rental Pte. Ltd.</div>
              <div style={{marginTop:'6pt'}}>Date: ____________________</div>
            </div>
            <div className="sig-item">
              <div style={{marginBottom: '28pt'}}>Hirer Signature</div>
              <div>Name: {hirerName || '____________________'}</div>
              <div style={{marginTop:'6pt'}}>Date: ____________________</div>
            </div>
          </div>

          <div className="page-num">Page 1 of 5</div>
        </div>

        {/* ---- PAGES 2–5: Terms & Conditions ---- */}
        {[0, 1, 2, 3].map((chunk, idx) => {
          const lines = TERMS_TEXT.split('\n');
          const chunkSize = Math.ceil(lines.length / 4);
          const start = chunk * chunkSize;
          const end = Math.min(start + chunkSize, lines.length);
          const chunkText = lines.slice(start, end).join('\n');
          return (
            <div key={chunk} className={idx < 3 ? 'page' : ''}>
              {idx === 0 && (
                <div style={{fontWeight:'bold', fontSize:'11pt', marginBottom:'10pt', borderBottom:'2px solid #000', paddingBottom:'5pt'}}>
                  TERMS AND CONDITIONS
                </div>
              )}
              <div className="terms-section">{chunkText}</div>
              {/* Signature block on each terms page */}
              <div className="signature-block">
                <div className="sig-item">
                  <div style={{marginBottom: '24pt'}}>Owner Signature</div>
                  <div>Date: ____________________</div>
                </div>
                <div className="sig-item">
                  <div style={{marginBottom: '24pt'}}>Hirer Signature</div>
                  <div>Date: ____________________</div>
                </div>
              </div>
              <div className="page-num">Page {idx + 2} of 5</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
