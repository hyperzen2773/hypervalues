# hypervalues
An original political ideology test using a decision tree architecture to provide nuanced results based on your unique combination of political values.

## Attribution and changes

HyperValues is a modified version of [NeoValues](https://github.com/neomediavalist/neovalues) by neomediavalist, licensed under [CC BY-NC-SA 4.0](./LICENSE). This version is distributed under the same license.

Changes from the original:
- Renamed from NeoValues to HyperValues.
- Removed the Contact, Support and Other tests pages and links.
- The "Next closest match" score is now `score × (identical values / values the ideology requires)`, instead of the raw score, so ideologies with many partial matches no longer outrank ideologies that match more of their own values.
