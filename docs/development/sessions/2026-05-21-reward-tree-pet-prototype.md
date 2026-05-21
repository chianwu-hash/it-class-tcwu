# Reward Tree Pet Prototype

Date: 2026-05-21

Branch: `feature/reward-tree-pet`

Current prototype commit: `1100c3a Prototype reward tree pet animation`

## Purpose

Add a small animated pet near the `my-tree.html` reward tree to make the page feel more alive and emotionally rewarding.

This is intentionally isolated on a feature branch and should not be merged into `main` until the motion, readability, and classroom performance feel mature.

## Current Scope

Only `my-tree.html` is changed in the prototype branch.

No database changes.

No Supabase writes.

No new image files.

The pet is built with inline SVG and CSS animation so it does not add another large runtime asset.

## Current Behavior

The pet:

- appears only after the tree trunk image has loaded
- walks around near the base of the reward tree
- uses a non-linear path with multiple waypoints, size changes, and vertical movement to create a loose "wandering around" feeling
- turns direction based on movement direction
- has a darker outline and cream body color so it does not blend into the pale background
- occasionally stops and shows a `汪！` speech bubble
- switches to a front-facing face while barking
- includes idle-style details such as tail wagging and small paw movement
- has an experimental stop/sit/scratch-head behavior
- respects `prefers-reduced-motion: reduce` by disabling pet animations

## Implementation Notes

The prototype adds these main pieces to `my-tree.html`:

- `.tree-pet-track`
- `.tree-pet`
- inline `.pet-dog` SVG
- `.pet-bark`
- face groups:
  - `.pet-face-side`
  - `.pet-face-front`
- body / paw groups:
  - `.pet-body-main`
  - `.pet-body-shine`
  - `.pet-paw`
  - `.pet-walk-paw-front`
  - `.pet-scratch-paw`
- keyframes:
  - `petWalk`
  - `petBodyMotion`
  - `petFace`
  - `petLook`
  - `petBark`
  - `petFrontFace`
  - `petSideFace`
  - `petTail`
  - `petPawA`
  - `petPawB`
  - `petScratchPaw`

The pet is inserted inside `.tree-stage`, after `#reward-layer`, with `aria-hidden="true"` so it is decorative.

## Design Decisions So Far

Use a small dog rather than a generic mascot because the user liked the visual direction from the reference image.

Keep the pet in the foreground near the tree roots, but avoid blocking leaves, flowers, login gate, or reward click targets.

Use CSS and SVG instead of a generated image sprite for now, because rapid iteration is easier and asset loading stays light.

Keep all pet work on `feature/reward-tree-pet` until it is ready for review and merge.

## Issues Already Found And Addressed

- Initial movement looked like simple horizontal sliding.
  - Added non-linear path and size / bottom changes.
- Dog looked like it was floating.
  - Added body bounce, paw movement, and tail movement.
- White dog blended into the background.
  - Changed to cream fill with stronger brown outline.
- Paw animation looked like disconnected legs.
  - Replaced with simpler short paws and reduced paw travel.
- Bark bubble was partly hidden or clipped.
  - Moved bubble, increased width, padding, font size, and line-height.
- Barking face should look at the viewer.
  - Added side/front face groups and swaps during bark timing.
- Some segments looked like backward walking.
  - Adjusted `petFace` timing to better align direction with route.

## Current Risk / Not Yet Mature

The scratch-head action is still experimental. It may still look awkward at small sizes or during direction flips.

The route is keyframe-based, not truly random. It only gives the impression of wandering. If this grows, a small JavaScript waypoint controller may be more maintainable than one long CSS keyframe sequence.

The SVG and CSS are embedded directly in `my-tree.html`. If accepted, consider extracting the pet into a shared component or separate CSS section to keep `my-tree.html` easier to maintain.

The pet uses many CSS keyframes. Before merging, test on classroom devices to make sure it does not cause animation jank.

The pet is decorative, but it may draw too much attention during class if it barks too often. Bark frequency should be classroom-tested.

## Verification Done

Smoke test run on `http://localhost:3000/my-tree.html?mock=full`.

Verified:

- page loads
- tree image uses `empty-tree-base-v1-q80.webp`
- pet track becomes visible
- `.pet-dog` exists
- bark text is `汪！`
- front face exists
- scratch paw exists
- reward items still render
- no console errors

## Suggested Next Steps

1. Review visually in browser with the user and decide whether the pet should stay a dog.
2. Tune scratch-head action or remove it if it remains visually confusing.
3. Decide whether barking should happen less often.
4. Test mobile viewport to ensure the pet does not cover important rewards.
5. Run smoke test with delayed tree image to confirm pet still waits for trunk load.
6. If accepted, consider extracting pet CSS / SVG into a small shared snippet or documenting the inline structure before merge.
7. Merge `feature/reward-tree-pet` into `main` only after the animation feels stable enough for classroom use.

