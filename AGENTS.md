# AGENTS.md — Garden Bastion TD

## Project Overview
3D Roblox *Garden Tower Defense*-inspired web game built with **TypeScript**, **Vite**, and **Three.js (WebGL)**.

## Essential Commands
- Install dependencies: `npm install`
- Start local dev server: `npm run dev`
- Strict type-check: `npm run typecheck` (`tsc --noEmit`)
- Unit tests: `npm test` (`vitest run`)
- Balance tester: `npm run balance`
- E2E smoke test: `npm run test:e2e` (`playwright test`)
- Production build: `npm run build`
- Preview production bundle: `npm run preview`

## Non-Negotiable Architecture Rules
1. Zero External Asset Dependencies: never reference `.glb`, `.gltf`, `.png`, `.jpg`, or `.mp3` files. Everything is procedural.
2. Zero Hot-Loop Allocations: never create `new THREE.Mesh()`, `new THREE.Vector3()`, `new THREE.Matrix4()` inside update loops. Use pools and scratch objects.
3. Delta-Time & Game Speed Scaling: multiply all timers, spline speeds, springs, and shader time by clamped `dt × S`. Hit-stop and slow-mo go through `TimeScale.ts` only.
4. Selective UnrealBloom: keep environment/grass `emissiveIntensity <= 0.4`, below the bloom threshold.
5. Save Backward Compatibility: version keys in `SaveManager.ts` (`garden_bastion_save_v2`) and migrate from `garden_bastion_save_v1`.
6. GitHub Pages Base Path: always keep `base: '/TowerDefense/'` in `vite.config.ts`.
7. Every new VFX goes through `VFXRecipes.ts` and must respect `QualityManager` tiers and Reduced Motion.
8. Every player action needs feedback on at least two channels (visual + audio or motion).
9. Use `Easing.ts` for all tweens. No hand-written one-off easing.
10. Plants grow from soil mounds with roots. Never add flowerpots back. Level and rarity are shown through roots, mound and ground details.
11. Root geometry comes from the 6 shared root shapes built at startup. Never build a new `TubeGeometry` per tower.
12. Every enemy death ends with the pooled dissolve material.
13. Every boss attack needs a telegraph of at least 1.2 s.
14. Every UI change is checked in a real browser at 1366x768 and 1920x1080: no text overflow, no text under 14 px.
15. Touch controls must keep working: tap, pinch, two-finger rotate.
16. Run `npm run typecheck && npm test && npm run build` before committing.
17. Every balance number lives in `src/data/BalanceConfig.ts`. No magic numbers in simulation code. Change a number → run `npm run balance` → paste the result table into the PR.
18. Every screen is a Screen class registered in `src/ui/ScreenRouter.ts`. Screens open and close through the router only, so Back/Esc always works.
19. Maps are built from `MapLayout` data + the shared `PropKit`. No one-off meshes inside map code.
20. Buttons use the shared garden button styles (leaf, wood sign, seed pod). No plain rectangle buttons with a thin border.
21. Every enemy is built with `BugRigKit` (`src/rendering/bugs/`). No hand-built enemy meshes elsewhere.
22. Every key action goes through `src/core/Keybinds.ts`. Never read `e.code` directly in game or UI code.
23. Every new VFX has a Low/Medium/High version in `VFXRecipes.ts`.
24. Every button shows its key hint (e.g. `Upgrade [E]`) when a keyboard is in use.

## Adding New Units or Enemies
1. Register stats, costs, caps, abilities in `src/data/UnitRegistry.ts` or `EnemyRegistry.ts`.
2. Add procedural mesh (Level 0–5 evolution) in `src/rendering/MeshFactory.ts`.
3. Add attack keyframes in `Animator.ts` and VFX recipes in `VFXRecipes.ts`.
4. Fill the unit's row in the Signature Animation sheet (idle, attack, impact, Lv.5 extra) and add a death animation for enemies.
5. Run `npm run typecheck && npm test && npm run build` before committing or pushing.
