# Frontend UI and UX audit

Audited: 28 September 2026. Scope: the React client in `client/src`, its routes, shared components, Ant Design theme, and page styles. Findings below come from source inspection and compilation; authenticated browser flows were not available for visual verification.

## Current strengths

- Ant Design already supplies consistent base controls, keyboard behavior, and form validation.
- The app has semantic CSS variables, a central Ant Design theme, permission aware navigation, and a clear module structure.
- Several list pages use shared headers and mobile card alternatives. Sales, purchasing, finance, and production already provide useful route structure.
- Business data loading is centralized in `useApiData`, and many destructive supplier actions already use confirmation.

## Findings and priority

| Priority | Area | Finding | User effect |
| --- | --- | --- | --- |
| Critical | Header | Search accepted text without searching; the notification badge showed a fixed count without an action. | Misleading controls. |
| Critical | Customers | Both Add Customer buttons had no click action. | Core task could not be started from the customer list. |
| Critical | Dashboard | Due amount cards displayed hardcoded zero; the Purchases label displayed inventory value and every card showed a false upward trend cue. | Financial overview could mislead decisions. |
| High | Mobile lists | `ResponsiveDataTable` rendered all rows on phones and showed an empty state while loading. | Slow, long lists and unclear loading. |
| High | Navigation | Sidebar selection used exact paths for most modules. Detail and form routes lost their active module cue. | Users could lose orientation. |
| High | Accessibility | Mobile bottom navigation used clickable `div` elements. Several icon only controls lack labels or focus treatment. | Keyboard and screen reader use is harder. |
| Medium | Design system | CSS tokens, Ant Design theme, and global overrides repeated different brand colors, radii, shadows, and font stacks. | Screens feel subtly inconsistent. |
| Medium | Typography | Page titles mixed system sans and inline Playfair references; some pages used 28–40 px headings. | Weak page hierarchy. |
| Medium | Status | Tables use raw hex values and different Ant Design Tag color names for similar statuses. | Status meaning varies by module. |
| Medium | Layout | Many page components use inline padding and one off cards, while global mobile CSS uses broad selectors and `!important`. | Responsive behavior is hard to maintain. |
| Medium | Performance | All module routes were imported into the initial application bundle. | First load downloaded code for pages the user had not opened. |
| Low | Icons | Ant Design icons dominate, but `lucide-react` is also installed. | Potential visual drift where both are used. |

## Responsive and accessibility review

The code has a desktop sidebar, mobile drawer, bottom navigation, mobile card lists, and table overflow handling. The main responsive risk is broad global selectors that alter every card and heading, plus screens that still render desktop tables inside narrow viewports. Source inspection does not establish actual layout quality at 375, 430, 768, 1024, 1280, 1440, and 1920 pixels; those widths need browser review with real data.

Labels are present in many Ant Design forms. The most immediate accessibility gaps were misleading header controls, nonsemantic mobile navigation, small icon targets, inconsistent focus indicators, and status colors that varied between pages. Contrast should be measured in rendered pages, especially disabled, muted, and status states.

## Implementation order and progress

1. **Shared foundation — started:** align semantic palette, radius, typography, card depth, control size, and focus treatment across CSS and Ant Design. Page titles now use one system sans stack and a 28 px desktop scale; body text is 14 px with 1.5 line height.
2. **Shared shell — started:** remove inactive header controls, correct route titles and sidebar selection, and make mobile navigation semantic.
3. **Shared data lists — started:** show a mobile loading state and paginate mobile cards.
4. **Core workflows — started:** wire Add Customer to a validated creation form and preserve the existing API contract.
5. **Dashboard — started:** use existing aging reports for overdue amounts, label inventory value accurately, and remove unsupported trend claims.
6. **Route loading — done:** load business modules on demand inside the persistent application shell.
7. **Spacing — started:** replace repeated page padding with a shared 24 px desktop and 16 px mobile gutter, and use shared section, card, and form spacing tokens. Finance, dashboard, purchasing, manufacturing, inventory, and report roots now use that gutter where their layouts permit it.
   The POS mobile workflow now uses the same 16 px outer gutter and 12–14 px text for its key labels and actions, replacing some 8–10 px styles.
8. **Next module pass:** consolidate status badges, form sections, empty and error states, and table alignment in purchasing, inventory, manufacturing, sales, finance, and reports. Keep business logic unchanged.
9. **Visual verification:** inspect representative pages and flows at the requested viewport widths, then address any confirmed overflow or hierarchy defects.

This audit is a working record. The broad module pass and authenticated visual review remain open; the shared changes above do not by themselves establish that every page is consistent.
