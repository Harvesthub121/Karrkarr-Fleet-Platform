import { getSession } from '@/lib/session';
import EarlyPaymentCalculator from './EarlyPaymentCalculator';

async function getRewardsData(token: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/portal/rewards`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function RewardsPage() {
  const session = await getSession();
  const data = session?.token ? await getRewardsData(session.token) : null;

  const upcomingInvoice = data?.upcomingInvoice;
  const daysUntilDue = upcomingInvoice
    ? Math.max(0, Math.floor((new Date(upcomingInvoice.dueDate).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rewards &amp; Credits</h1>
        <p className="text-gray-500 mt-1">Earn credits by paying your invoices early</p>
      </div>

      {/* Credit Balance Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Available Credits</p>
          <p className="text-4xl font-bold text-green-600 mt-2">
            {data?.balance?.display ?? 'S$0.00'}
          </p>
          <p className="text-xs text-gray-400 mt-2">Use credits to offset your next rental payment</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Earned</p>
          <p className="text-2xl font-bold text-teal-600 mt-2">{data?.totalEarned?.display ?? 'S$0.00'}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Redeemed</p>
          <p className="text-2xl font-bold text-gray-700 mt-2">{data?.totalRedeemed?.display ?? 'S$0.00'}</p>
        </div>
      </div>

      {/* Next Payment Card */}
      {upcomingInvoice && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Next Payment</h2>
          <div className="flex flex-wrap gap-6 items-center">
            <div>
              <p className="text-xs text-gray-400 uppercase">Invoice</p>
              <p className="font-semibold text-gray-800">{upcomingInvoice.invoiceNo}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase">Due Date</p>
              <p className="font-semibold text-gray-800">
                {new Date(upcomingInvoice.dueDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase">Outstanding</p>
              <p className="font-semibold text-gray-800">
                S${((upcomingInvoice.outstandingCents ?? 0) / 100).toFixed(2)}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-gray-400 uppercase">Days Until Due</p>
              <p className={`text-3xl font-bold ${daysUntilDue !== null && daysUntilDue <= 7 ? 'text-red-500' : 'text-teal-600'}`}>
                {daysUntilDue ?? '–'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Early Payment Calculator */}
      <EarlyPaymentCalculator dueDate={upcomingInvoice?.dueDate ?? null} />

      {/* Penalty Notice Card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <span className="text-amber-500 text-xl">⚠️</span>
          <div>
            <h2 className="text-base font-semibold text-amber-800">Late Payment Penalty</h2>
            <ul className="mt-2 text-sm text-amber-700 space-y-1">
              <li>Payments past due incur <strong>1% daily interest</strong> on outstanding principal</li>
              <li>A <strong>3-day grace period</strong> applies before interest starts</li>
              <li>Interest accrues until payment is settled and is added to your final bill</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Credit History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Credit History</h2>
        {data?.history?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Description</th>
                  <th className="pb-2 pr-4">Days Early</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.history.map((c: any) => (
                  <tr key={c.id}>
                    <td className="py-3 pr-4 text-gray-600">
                      {new Date(c.earnedAt).toLocaleDateString('en-SG')}
                    </td>
                    <td className="py-3 pr-4 text-gray-800">{c.description}</td>
                    <td className="py-3 pr-4 text-gray-600">{c.daysEarlyPaid ?? '–'}</td>
                    <td className="py-3 pr-4 font-medium text-gray-800">{c.amountDisplay}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.type === 'EARNED' ? 'bg-green-100 text-green-700' :
                        c.type === 'REDEEMED' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {c.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No credit history yet. Pay early to start earning!</p>
        )}
      </div>
    </div>
  );
}
