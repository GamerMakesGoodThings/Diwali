# DiyaVerse Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Path & ID Integrity**: Every greeting resides at `/greetings/{greetingId}` where `greetingId` matches `^[a-zA-Z0-9_\-]{6,32}$` and strictly equals `request.resource.data.id`.
2. **No Blanket List Enumeration**: Because DiyaVerse uses unguessable short IDs (`k7Qx9mA2`) without user accounts, `list` queries on `/greetings` are completely forbidden (`allow list: if false;`). Only single-document `get` by a valid ID is permitted.
3. **Strict Schema & Volumetric Bounds**: Every `Greeting` document must contain all 16 required keys and zero unapproved shadow keys (`hasAll` + `hasOnly`). Every string field has an explicit maximum length (`recipientName <= 40`, `messageText <= 600`, `rangoliStrokesJson <= 16384`).
4. **Immutable Core & Action-Based Monotonic Counter Updates**: Once created, `id`, `theme`, `recipientName`, `recipientLang`, `recipientTone`, `messageText`, `messageTranslation`, `messageSource`, `rangoliSymmetry`, `rangoliPalette`, `rangoliStrokesJson`, and `createdAt` are strictly immutable. Updates may only increment `litCount` by `+1` or `opensCount` by `+1` while setting `updatedAt == request.time`, and only while `existing().status == 'active'`.
5. **Temporal Integrity**: `createdAt` on create and `updatedAt` on create/update must equal `request.time`.

## 2. The "Dirty Dozen" Payloads
1. **Shadow Field Injection**: Create payload containing `"isAdmin": true` alongside required fields.
2. **Oversized Recipient Name (Denial of Wallet)**: `recipientName` with 5,000 characters (`> 40`).
3. **Oversized Rangoli Payload**: `rangoliStrokesJson` with 50,000 characters (`> 16384`).
4. **Invalid Theme Enum**: `theme: "neon-cyberpunk"` (not in `['royal-marigold', 'midnight-indigo', 'sacred-terracotta']`).
5. **Invalid Language Enum**: `recipientLang: "fr"` (not in `['en', 'hi', 'bn', 'mr']`).
6. **Invalid Symmetry Axis**: `rangoliSymmetry: 99` (not in `[6, 8, 12]`).
7. **ID Mismatch Poisoning**: Document path `/greetings/k7Qx9mA2` where payload `id` is `"otherId12"`.
8. **Forged Creation Timestamp**: `createdAt` set to a past or future timestamp instead of `request.time`.
9. **Non-Zero Initial Counters**: Creating a greeting with `litCount: 9999` instead of `0`.
10. **Message Tampering on Update**: Updating `messageText` after publication during a counter increment.
11. **Bulk Counter Inflation**: Incrementing `litCount` by `+500` in a single update instead of `+1`.
12. **Terminal State Bypass**: Updating a greeting whose `status` is `'archived'`.
