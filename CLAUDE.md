# Glacier Photo Vault - Project Rules

## CSS / Layout Rules (MUST FOLLOW)

### Overflow Prevention (Critical)
Right-side overflow is a recurring issue. Follow these rules strictly:

1. **All containers must prevent horizontal overflow**
   - Apply `overflow-x: hidden` to `html` or `body`
   - Never use `width: 100vw` (causes scrollbar-width overflow). Use `width: 100%` instead

2. **Flex children must include `min-w-0`**
   - Flex items have `min-width: auto` by default, which prevents them from shrinking below content size
   - Always add `min-w-0` (Tailwind) to flex children that contain text, inputs, or dynamic content
   - Example: `<input className="flex-1 min-w-0 ..." />`

3. **Fixed-width siblings in flex must use `flex-shrink-0`**
   - Buttons, icons, or fixed elements next to flexible content: add `flex-shrink-0`
   - Example: `<button className="flex-shrink-0 ..." />`

4. **All inputs/textareas must include `box-border`**
   - Ensures padding is included in width calculation
   - Prevents padding from causing overflow

5. **Use `overflow-hidden` or `truncate` on text containers**
   - For text that might exceed container width, use `overflow-hidden`, `truncate`, or `break-words`

6. **Flex layouts with space-between**
   - Use `justify-between` instead of `gap-N` when items must stay within container bounds

7. **Mobile-first approach**
   - Always test layouts at 320px width minimum
   - `max-w-full` on images and media elements
   - Avoid hardcoded widths (`w-[400px]`), use responsive alternatives (`w-full max-w-md`)

### Mobile Scroll Prevention
- Never use `overflow: hidden` on `#root`, `body`, or `html` for vertical axis
- Use `min-height: 100vh` instead of `height: 100vh` for full-page containers
- Never use `flex items-center justify-center` for full-page layouts on mobile (content taller than viewport becomes unreachable). Use `py-8` with `sm:flex sm:items-center` instead
- Add `-webkit-overflow-scrolling: touch` for iOS scroll support

## Tech Stack
- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Express + TypeScript + PostgreSQL (Supabase)
- Storage: AWS S3 Glacier
- Auth: LINE OAuth / Google OAuth
- Payment: Stripe (subscriptions, usage-based billing)
- Deployment: Vercel (frontend) + Render (backend)
