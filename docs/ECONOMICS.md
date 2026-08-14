# Simble — Economics

## Operating cost (3-phone deployment at friend's house)

| Item | Cost/mo |
|---|---|
| VPS (Hostinger KVM 4) | $24.99 |
| Domain (~$12/yr amortized) | $1.00 |
| 3x Tello SIMs (basic plan) | $15-30 |
| Electricity at friend's house | $5 |
| Backblaze B2 backups | $1 |
| **Total** | **$45-60/mo** |

That supports ~3,000-15,000 SMS/mo at carrier throttling (1 msg per 2-3 sec per phone).

## SMS capacity
- Per phone (consumer SIM): 1,000-3,000 SMS/mo safe, up to ~10,000/mo with throttling
- 3 phones: 3,000-30,000 SMS/mo total realistic
- Soft cap: carriers flag consumer SIMs at >3,000 SMS/mo; risk of SIM swap

## Pricing tiers

| Tier | Price/mo | SMS/mo | Phones | Features |
|---|---|---|---|---|
| Starter | $49 | 500 | 1 | Bulk send, CSV import |
| Growth | $149 | 2,500 | 1 | + scheduling, delivery reports, templates |
| Agency | $399 | 10,000 | 2 | + multi-user, white-label |

## Margin analysis
At 10 Growth clients:
- Revenue: $1,490/mo
- Cost: ~$60/mo (VPS + SIMs)
- **Margin: ~96%**

Bottleneck is **fleet management time**, not server cost.

## Hard constraints to price around
- Tello/Mint soft-cap ~1,000-3,000 SMS/mo per line
- For 10k+ SMS/mo tiers, need 10DLC registration ($1-4/mo per number + verification effort) or A2P fallback (Twilio/Bandwidth/Sinch at $0.0075-0.01/SMS)
- Friend-site reliability: power, WiFi, phone battery death — single point of failure

## Strategy
Position Starter/Growth as **"low-volume, local presence, human-feel marketing"** — actually a feature vs. mass Twilio blasts (higher open rates, looks like a real local number). Reserve high-volume for an A2P-backed tier added later.

## Multi-channel cost (Phase 5+)

| Channel | Per-message | Volume pricing |
|---|---|---|
| Telegram | Free | Free unlimited |
| WhatsApp Cloud | $0.005-0.09/conv | Tiered by country |
| Viber | $0.005-0.02/msg | Volume discounts |
| Line | $0.01-0.05/msg | Tiered by tier |
| Zalo | Cheap | VN market only |

Telegram is the only true free channel — should be the lead channel wherever the market uses it (CIS, Iran, parts of LatAm/EU).
