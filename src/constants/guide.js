// Content for the Guide view: explains report fields, verdict statements,
// categories and colours. Keep in sync with server/services/verdictService.js
// and VERDICT_THRESHOLDS in server/config/index.js.

export const TONES = [
  { tone: 'positive', label: 'Green', meaning: 'Strength or bullish signal.' },
  { tone: 'negative', label: 'Red', meaning: 'Weakness or risk (not necessarily a falling price).' },
  { tone: 'neutral', label: 'Grey', meaning: 'Informational, neither good nor bad.' }
]

export const CATEGORIES = [
  { name: 'Large-cap Leader', tone: 'brand', when: 'Large cap with high or very high turnover/volume.', action: 'Strongest and easiest to exit. Track for pullback or continuation.' },
  { name: 'Upper Circuit', tone: 'up', when: 'Hit the upper circuit and is not a small/micro cap.', action: 'Strong demand. Check the next-day open; a locked circuit can block buying or selling.' },
  { name: 'Low-cap Upper Circuit', tone: 'up', when: 'Hit the upper circuit and is a small/micro cap.', action: 'High reward, high risk. Easy to get in, hard to get out. Avoid chasing.' },
  { name: 'Low-cap Momentum', tone: 'warn', when: 'Small/micro cap with high turnover/volume.', action: 'Speculative. Needs a clear reason and a strict stop-loss.' },
  { name: 'High-activity Mover', tone: 'brand', when: 'Mid cap (or unknown cap) with high turnover/volume.', action: 'Real participation. Look for a news or results trigger.' },
  { name: 'Thin Mover (Low Liquidity)', tone: 'down', when: 'Low turnover or volume.', action: 'Treat as a trap or untradable. Moves can reverse without warning.' },
  { name: 'Regular Mover', tone: 'neutral', when: 'None of the above.', action: 'Nothing special. Ignore unless another signal stands out.' }
]

// Category name -> pill colour tone (used by the Report table and this guide).
export const CATEGORY_TONE = Object.fromEntries(CATEGORIES.map((c) => [c.name, c.tone]))

// Meaning of the category pill colours.
export const CATEGORY_COLOURS = [
  { tone: 'up', label: 'Green', meaning: 'Upper circuit hit: the strongest demand signal.' },
  { tone: 'brand', label: 'Indigo', meaning: 'Strong move backed by high turnover/volume, without a circuit hit.' },
  { tone: 'warn', label: 'Amber', meaning: 'Speculative: small/micro cap with high activity.' },
  { tone: 'down', label: 'Red', meaning: 'Thin liquidity: may be hard to trade.' },
  { tone: 'neutral', label: 'Grey', meaning: 'Regular Mover: nothing special.' }
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

export const VIEWS = [
  { name: 'Stored report (Today off)', meaning: 'Top 3 gainers recorded at the 3:30 PM close, one batch per trading day. Earlier days stay listed, newest first.' },
  { name: 'Today (switch on)', meaning: 'Every stock in the latest stored gainers snapshot, sorted by % change. It updates about every 15 minutes while the market is open. Outside market hours it shows the last trading day. Stocks that dropped out of the live list stay with their last-known values. The switch setting is remembered in the browser.' }
]

// `column` is where the field appears in the Report table.
export const FIELDS = [
  { name: 'Symbol', column: 'Stock', meaning: 'NSE trading symbol. A star next to it means AI recommended the stock during the day.' },
  { name: 'Category', column: 'Stock', meaning: 'One summary label for the stock (see Categories).' },
  { name: 'LTP', column: 'Price', meaning: 'Last traded price. In the stored report it is the price at the 15:30 IST close; in the Today view it is the latest stored price.' },
  { name: 'Change (%)', column: 'Price', meaning: 'Move versus the previous close.' },
  { name: 'Verdict', column: 'Verdict', meaning: 'List of plain statements describing the stock (see Verdict statements). Up to 9 can apply.' },
  { name: 'Open / High / Low', column: 'Day Range', meaning: 'First price, highest price and lowest price of the day.' },
  { name: 'Prev Close', column: 'Day Range', meaning: 'Closing price of the previous trading day.' },
  { name: 'VWAP', column: 'Day Range', meaning: 'Volume-weighted average price. Above it means buyers are in control; below it means sellers are.' },
  { name: 'Volume', column: 'Activity & Circuit', meaning: 'Number of shares traded in the day.' },
  { name: 'Turnover', column: 'Activity & Circuit', meaning: 'Total money traded in the day, shown in lakh (L) or crore (Cr).' },
  { name: 'Mkt Cap', column: 'Activity & Circuit', meaning: 'Market capitalisation in rupees: price x shares outstanding. Shows company size.' },
  { name: 'Lower / Upper', column: 'Activity & Circuit', meaning: 'Lower and upper circuit prices. The stock cannot trade beyond them.' },
  { name: 'Date', column: 'Date & Time', meaning: 'Trading day the row belongs to (DD-MM-YYYY).' },
  { name: 'Created', column: 'Date & Time', meaning: 'Time (IST) the stock first appeared in the gainers list that day.' },
  { name: 'Modified', column: 'Date & Time', meaning: 'Time (IST) of its last data update.' },
  { name: 'Change (₹) / Price Band', column: 'CSV only', meaning: 'Rupee change and circuit band percentage. Not shown in the table but included in the CSV download.' }
]

export const ROUTINE = [
  'Drop anything marked Thin Mover or showing low turnover/volume.',
  'Keep stocks with a clear reason (results, order win, dividend) and a green close (near day high, above VWAP).',
  'Rank what is left by cap size. Large and mid caps carry less risk; low caps need smaller positions.',
  'Watch the next session open before acting. Do not chase a gap-up without news.',
  'Skip stocks showing green and red together (for example circuit hit with thin liquidity). That is a typical pump-and-dump profile.'
]
