# Pricing & Market Ideas

## High Priority

### Multi-Source Pricing
- **Multiple Price Sources**: Toggle between Exor Games, TCGPlayer, CardKingdom, Face to Face, 401 Games
- **Price Source Selector**: Let user choose their preferred pricing source globally or per-card
- **Foil Pricing**: Separate price tracking for foil vs non-foil versions (currently same price for both)
- **Condition-Based Pricing**: Apply condition multipliers to base price (NM=100%, LP=85%, MP=70%, HP=50%, DMG=30%)
- **Currency Selection**: Support USD, CAD, EUR, GBP with live conversion rates
- **Price Source Badge**: Show which source each card's price came from in the table

### Price History
- **Price Snapshots**: Store daily/weekly price snapshots in the database for historical tracking
- **Price History Chart**: Per-card line graph showing price over 30/90/365 days
- **Collection Value History**: Graph showing total collection value over time
- **Price Change Column**: Show price change since last update (e.g., "+$0.50" or "-$1.20" with color)
- **All-Time High/Low**: Track and display each card's highest and lowest recorded price
- **Price Trend Indicator**: Arrow or spark line showing price direction (trending up/down/stable)

### Price Alerts
- **Price Drop Alerts**: Set alerts for when cards drop below a threshold
- **Price Spike Alerts**: Alert when cards in collection suddenly increase in value
- **Wishlist Price Alerts**: Alert when wishlist cards hit target price
- **Daily Price Report**: Summary of all price changes in collection since yesterday
- **Browser Notifications**: Use Notification API for price alerts without needing email
- **Alert History**: Log of all triggered price alerts

## Medium Priority

### Market Intelligence
- **Market Trends Dashboard**: Show trending cards (biggest movers up and down across all of MTG)
- **Buylist Prices**: Show what stores will pay for your cards (buylist vs retail spread)
- **Price Spread Analysis**: Show the gap between buy and sell prices for your cards
- **Seasonal Price Patterns**: Historical patterns (e.g., commander cards spike before Commander Legends release)
- **Reprint Impact Tracker**: Show how reprints affected card prices historically
- **Standard Rotation Impact**: Flag cards about to rotate out of Standard (price usually drops)
- **Supply/Demand Indicator**: If available, show relative supply/demand for cards

### Value Calculations
- **Total Collection Value by Condition**: Break down value by NM, LP, MP, etc.
- **Buylist Value**: Total value if you sold everything at buylist prices
- **Replacement Cost**: Total cost to re-acquire your entire collection at current market prices
- **Insurance Value**: Calculated as replacement cost with condition considered
- **Deck Values Dashboard**: Side-by-side comparison of all deck values
- **Value per Card in Deck**: Show card-by-card value breakdown within decks
- **ROI Tracking**: If purchase prices are recorded, show return on investment per card

### Canadian-Specific
- **More Canadian Stores**: Add pricing from Face to Face Games, 401 Games, Wizard's Tower, GameZilla, Fusion Gaming
- **CAD/USD Toggle**: Show prices in either CAD or USD with one click
- **Local Store Price Comparison**: Compare prices across multiple Canadian LGS
- **Shipping Calculator**: Estimate shipping costs when comparing store prices
- **Store Loyalty Integration**: Track loyalty points or store credit at different stores

## Lower Priority

- **Price Prediction**: ML-based price prediction for cards based on historical data and format demand
- **Arbitrage Finder**: Find cards where buy price at one store is lower than sell price at another
- **Bulk Pricing**: Different pricing for bulk cards vs singles (bulk usually $0.05-0.10 per card)
- **Graded Card Pricing**: Price lookup for PSA/BGS graded versions
- **Sealed Product Value**: Track value of sealed products (boxes, bundles) in collection
- **Lot Value Calculator**: Calculate fair price for a lot of cards (bulk + singles pricing)
- **Price Database Contribution**: If using self-hosted pricing, let users contribute price data back
- **Historical Price Database**: Archive years of price data for deep analysis
