'use client';

import { useState } from 'react';

interface Props {
  dueDate: string | null;
}

interface CalcResult {
  creditCents: number;
  daysEarly: number;
  tier: string;
}

export default function EarlyPaymentCalculator({ dueDate }: Props) {
  const [paymentDate, setPaymentDate] = useState('');
  const [result, setResult] = useState<CalcResult | null>(null);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const handleDateChange = async (date: string) => {
    setPaymentDate(date);
    if (!date || !dueDate) return;

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/portal/rewards/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dueDate, paymentDate: date }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const tierProgress = result
    ? result.daysEarly >= 30 ? 100
    : result.daysEarly >= 15 ? 50 + ((result.daysEarly - 15) / 15) * 50
    : result.daysEarly >= 7 ? ((result.daysEarly - 7) / 8) * 50
    : 0
    : 0;

  const tierColor =
    result?.tier === '30+ days' ? 'bg-green-500' :
    result?.tier === '15-29 days' ? 'bg-teal-500' :
    result?.tier === '7-14 days' ? 'bg-yellow-400' :
    'bg-gray-200';

  const tierMessage =
    result?.tier === '30+ days' ? '30+ days: Maximum reward!' :
    result?.tier === '15-29 days' ? '15–29 days: Great reward!' :
    result?.tier === '7-14 days' ? '7–14 days: Partial reward' :
    result?.daysEarly === 0 ? 'Less than 7 days early — no credit' :
    '';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Pay in Advance — Earn Credits</h2>
        <p className="text-sm text-gray-500 mt-1">
          Select a payment date to see how much credit you&apos;d earn
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Date Picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Payment Date</label>
          <input
            type="date"
            value={paymentDate}
            min={today}
            max={dueDate ?? undefined}
            onChange={e => handleDateChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {!dueDate && (
            <p className="text-xs text-amber-600 mt-1">No upcoming invoice found</p>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Days in advance</span>
              <span className="font-semibold text-gray-800">{result.daysEarly} days</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Credits you&apos;d earn</span>
              <span className="text-xl font-bold text-green-600">
                {loading ? '...' : `S$${(result.creditCents / 100).toFixed(2)}`}
              </span>
            </div>
            {tierMessage && (
              <p className={`text-xs font-medium ${
                result.tier === '30+ days' ? 'text-green-600' :
                result.tier === '15-29 days' ? 'text-teal-600' :
                result.tier === '7-14 days' ? 'text-yellow-600' :
                'text-gray-400'
              }`}>{tierMessage}</p>
            )}
            {/* Progress bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${tierColor}`}
                style={{ width: `${tierProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tier Table */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Credit Tiers</h3>
        <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-2 px-3 text-gray-500 font-medium">Days Early</th>
              <th className="text-left py-2 px-3 text-gray-500 font-medium">Credit Earned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            <tr className="bg-white">
              <td className="py-2 px-3 text-gray-700">30+ days</td>
              <td className="py-2 px-3 font-semibold text-green-600">S$20.00</td>
            </tr>
            <tr className="bg-white">
              <td className="py-2 px-3 text-gray-700">15–29 days</td>
              <td className="py-2 px-3 font-medium text-teal-600">S$15–20 (pro-rated)</td>
            </tr>
            <tr className="bg-white">
              <td className="py-2 px-3 text-gray-700">7–14 days</td>
              <td className="py-2 px-3 font-medium text-yellow-600">S$10–15 (pro-rated)</td>
            </tr>
            <tr className="bg-white">
              <td className="py-2 px-3 text-gray-700">&lt; 7 days</td>
              <td className="py-2 px-3 text-gray-400">S$0.00</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-gray-400 mt-2">
          Credits are applied automatically to your next invoice upon approval
        </p>
      </div>
    </div>
  );
}
