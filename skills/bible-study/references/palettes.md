# Abide brand colours

Every Abide post uses only the brand palette from the Abide brand kit (https://claude.ai/artifact/8pYDdq7MR1Sx9HKegnMQmb). Lighter tints and darker shades of these colours are fine for panels, dividers and backgrounds, but never introduce a new hue.

| name       | hex     | role                              |
|------------|---------|-----------------------------------|
| Vine       | #1B2A1F | deep green                        |
| Leaf       | #3F5F2A | mid green                         |
| New growth | #B7D68F | fresh green                       |
| Cream      | #EFEEE3 | warm light                        |
| Parchment  | #DFE3D0 | soft light                        |
| Fruit      | #5B3A6E | deep grape, for grace and fruit   |
| Still water| #2F4B5E | muted deep blue, for peace and trust (Psalm 23:2) |
| Harvest    | #C8A15A | warm wheat gold, used sparingly as a highlight    |

## Main, secondary, accent

Each post has one **main** colour that carries the message and covers most of the background (about 60–70%). The **secondary** colour is the headline and body text and tints the cube pattern (about 20–30%). The **accent** is used sparingly (about 10%) for the italic key phrase, the Abide mark, rules and small labels.

## Approved combinations

These are built into `scripts/build_carousel.py` as `COMBOS`, with contrast already checked. Harvest is strongest as an accent; use it as a main colour only occasionally.

| key       | main       | secondary | accent     | mood                                       |
|-----------|------------|-----------|------------|--------------------------------------------|
| vine      | Vine       | Cream     | New growth | depth, foundations, storms, endurance      |
| cream     | Cream      | Vine      | Leaf       | calm, rest, clarity, Scripture itself      |
| leaf      | Leaf       | Cream     | New growth | growth, abiding, fruitfulness, obedience   |
| parchment | Parchment  | Vine      | Fruit      | wisdom, reflection, quotes, the inner life |
| fruit     | Fruit      | Cream     | New growth | grace, redemption, the cross, prayer       |
| growth    | New growth | Vine      | Fruit      | hope, fresh starts, joy, resurrection      |
| water     | Still water| Cream     | New growth | peace, trust, the Spirit, living water, faith in storms |
| harvest   | Harvest    | Vine      | Fruit      | reaping, generosity, gratitude, the harvest (use rarely) |
| vine_gold | Vine       | Cream     | Harvest    | a warmer take on Vine: glory, worship, the kingdom |
| water_gold| Still water| Cream     | Harvest    | a warmer take on Still water: light in the dark, hope |

## Choosing combinations for a week

1. **Main combination (`combo`):** pick the one whose mood best matches the passage's dominant image or theme. It is used for the cover, the insight slides and the Friday challenge post.
2. **Key combination (`key_combo`):** pick a contrasting one (a light main if the main is dark, and vice versa). It is used for the passage, the Ellen White quote and the closing slide, and by default for the Wednesday quote and Friday prayer.
3. **Weekly posts can vary further:** set `"combo"` on the Wednesday quote, the prayer or the story to give each post its own main colour, as long as the week still feels like one set (use no more than three combinations in a week).
4. **Rotate week to week:** never use the same main combination two weeks running. This skill can't see past weeks, so name the combinations used in your reply ("Main: Leaf, key: Parchment") so the user can tell you what to avoid next time.

## Previous weeks

- Galatians 1:10, "Audience of One": main Fruit, key Parchment
- Matthew 7:24–27, "Built to Last": main Vine, key Cream
- 2 Corinthians 9:6, "The Open Hand": main Harvest, key Cream, story Vine gold

The next study should not use Harvest as its main combination.
