// Content for the Guide view: explains report fields, verdict statements,
// categories and colours. Keep in sync with server/services/verdictService.js
// and VERDICT_THRESHOLDS in server/config/index.js.

export const TONES = [
  { tone: 'positive', label: 'Green', meaning: 'Strength or bullish signal.' },
  { tone: 'negative', label: 'Red', meaning: 'Weakness or risk (not necessarily a falling price).' },
  { tone: 'neutral', label: 'Grey', meaning: 'Informational, neither good nor bad.' }
]

export const CATEGORIES = [
  { name: 'Large-cap Leader', when: 'Large cap with high or very high turnover/volume.', action: 'Strongest and easiest to exit. Track for pullback or continuation.' },
  { name: 'Upper Circuit', when: 'Hit the upper circuit and is not a small/micro cap.', action: 'Strong demand. Check the next-day open; a locked circuit can block buying or selling.' },
  { name: 'Low-cap Upper Circuit', when: 'Hit the upper circuit and is a small/micro cap.', action: 'High reward, high risk. Easy to get in, hard to get out. Avoid chasing.' },
  { name: 'Low-cap Momentum', when: 'Small/micro cap with high turnover/volume.', action: 'Speculative. Needs a clear reason and a strict stop-loss.' },
  { name: 'High-activity Mover', when: 'Mid cap (or unknown cap) with high turnover/volume.', action: 'Real participation. Look for a news or results trigger.' },
  { name: 'Thin Mover (Low Liquidity)', when: 'Low turnover or volume.', action: 'Treat as a trap or untradable. Moves can reverse without warning.' },
  { name: 'Regular Mover', when: 'None of the above.', action: 'Nothing special. Ignore unless another signal stands out.' }
]

export const STATEMENTS = [
  { group: 'Circuit', tone: 'positive', text: 'Hit the upper circuit', rule: 'LTP is at or above the upper circuit price.' },
  { group: 'Circuit', tone: 'positive', text: 'Trading close to the upper circuit', rule: 'LTP is within 1% of the upper circuit.' },
  { group: 'Circuit', tone: 'neutral', text: 'Touched the upper circuit but slipped back', rule: 'Day high reached the upper circuit but LTP is below it (failed breakout).' },
  { group: 'Market cap', tone: 'negative', text: 'Very low market cap (micro cap)', rule: 'Under ₹500 Cr. Easier to manipulate, harder to exit.' },
  { group: 'Market cap', tone: 'neutral', text: 'Low market cap (small cap)', rule: '₹500 Cr to under ₹5,000 Cr.' },
  { group: 'Market cap', tone: 'neutral', text: 'Mid market cap', rule: '₹5,000 Cr to under ₹20,000 Cr.' },
  { group: 'Market cap', tone: 'positive', text: 'High market cap (large cap)', rule: '₹20,000 Cr and above.' },
  { group: 'Turnover / volume', tone: 'positive', text: 'Very high turnover and volume', rule: 'Turnover of ₹500 Cr or more.' },
  { group: 'Turnover / volume', tone: 'positive', text: 'High turnover / volume', rule: 'Turnover of ₹100 Cr or more, or volume of 1 Cr shares or more.' },
  { group: 'Turnover / volume', tone: 'negative', text: 'Low turnover / volume (thin liquidity)', rule: 'Turnover under ₹10 Cr or volume under 1 L shares.' },
  { group: 'Turnover / volume', tone: 'positive', text: 'Heavy churn: X% of market cap traded in a day', rule: 'Turnover is 5% or more of market cap. Can mean a major event or a speculative frenzy.' },
  { group: 'Price action', tone: 'positive', text: 'Strong rally of X%', rule: 'Day change of 10% or more.' },
  { group: 'Price action', tone: 'positive', text: 'Gap-up open (+X%)', rule: 'Open is 3% or more above the previous close. News is already priced in; chasing can mean buying the top.' },
  { group: 'Price action', tone: 'positive', text: 'Closed near the day high', rule: 'LTP is in the top 10% of the day range.' },
  { group: 'Price action', tone: 'negative', text: 'Faded sharply from the day high', rule: 'LTP is in the bottom half of the day range.' },
  { group: 'Price action', tone: 'positive', text: 'Trading above VWAP (buyers in control)', rule: 'LTP is above the day average price.' },
  { group: 'Price action', tone: 'negative', text: 'Trading below VWAP (profit booking)', rule: 'LTP is below the day average price.' },
  { group: 'Other', tone: 'positive', text: 'Recommended by AI during the day', rule: 'The stock was flagged as an AI pick.' }
]

export const FIELDS = [
  { name: 'Symbol', meaning: 'NSE trading symbol.' },
  { name: 'LTP', meaning: 'Last traded price at capture time (15:30 IST close).' },
  { name: 'Change (%) / Change (₹)', meaning: 'Move versus the previous close.' },
  { name: 'Open / High / Low', meaning: 'First price, highest price and lowest price of the day.' },
  { name: 'Prev Close', meaning: 'Closing price of the previous trading day.' },
  { name: 'VWAP', meaning: 'Volume-weighted average price. Above it means buyers are in control; below it means sellers are.' },
  { name: 'Volume', meaning: 'Number of shares traded in the day.' },
  { name: 'Turnover (₹ L)', meaning: 'Total money traded in the day, in lakh (shown as L / Cr).' },
  { name: 'Mkt Cap', meaning: 'Market capitalisation in rupees: price x shares outstanding. Shows company size.' },
  { name: 'Lower / Upper Circuit', meaning: 'Daily price limits. The stock cannot trade beyond them.' },
  { name: 'Price Band', meaning: 'Circuit limit as a percentage (for example 5, 10, 20).' },
  { name: 'AI Pick', meaning: 'Marked when AI recommended the stock during the day.' },
  { name: 'Category', meaning: 'One summary label for the stock (see Categories).' },
  { name: 'Verdict', meaning: 'List of plain statements describing the stock (see Verdict statements).' }
]

export const ROUTINE = [
  'Drop anything marked Thin Mover or showing low turnover/volume.',
  'Keep stocks with a clear reason (results, order win, dividend) and a green close (near day high, above VWAP).',
  'Rank what is left by cap size. Large and mid caps carry less risk; low caps need smaller positions.',
  'Watch the next session open before acting. Do not chase a gap-up without news.',
  'Skip stocks showing green and red together (for example circuit hit with thin liquidity). That is a typical pump-and-dump profile.'
]
