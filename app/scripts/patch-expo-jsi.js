/**
 * Upstream fix for expo-modules-jsi 57.0.6 against Xcode 26.3+.
 *
 * RuntimeScheduler.h annotates its constructors with SWIFT_RETURNS_RETAINED but
 * only applies SWIFT_SHARED_REFERENCE at the closing brace, after those
 * constructors have already been parsed. Swift 6's C++ interop now rejects that
 * ordering:
 *
 *   error: 'RuntimeScheduler' cannot be annotated with either
 *   SWIFT_RETURNS_RETAINED or SWIFT_RETURNS_UNRETAINED because it is not
 *   returning a SWIFT_SHARED_REFERENCE type
 *
 * The class genuinely is a shared reference - it has refCount, retain() and
 * release(). This moves the annotation to the class declaration, where the
 * compiler sees it first, and forward-declares the two ARC hooks so they are
 * in scope at that point. Behaviour is unchanged; only the ordering moves.
 *
 * Runs from postinstall so `npm install` cannot silently undo it.
 */
const fs = require('fs');
const path = require('path');

const HEADER = path.join(
  __dirname, '..', 'node_modules', 'expo-modules-jsi', 'apple', 'Sources',
  'ExpoModulesJSI-Cxx', 'include', 'RuntimeScheduler.h',
);

if (!fs.existsSync(HEADER)) process.exit(0);

let src = fs.readFileSync(HEADER, 'utf8');
if (src.includes('// aquagrid-patched')) process.exit(0);
if (!src.includes('} SWIFT_SHARED_REFERENCE(retainRuntimeScheduler, releaseRuntimeScheduler);')) {
  console.log('[patch-expo-jsi] header no longer matches — upstream may have fixed it; skipping');
  process.exit(0);
}

src = src.replace(
  '#include <swift/bridging>\n\nnamespace expo {',
  `#include <swift/bridging>

// aquagrid-patched: see scripts/patch-expo-jsi.js
namespace expo {
class RuntimeScheduler;
} // namespace expo

inline void retainRuntimeScheduler(expo::RuntimeScheduler *scheduler);
inline void releaseRuntimeScheduler(expo::RuntimeScheduler *scheduler);

namespace expo {`,
);

src = src.replace(
  'class RuntimeScheduler {\npublic:',
  'class SWIFT_SHARED_REFERENCE(retainRuntimeScheduler, releaseRuntimeScheduler) RuntimeScheduler {\npublic:',
);

src = src.replace(
  '} SWIFT_SHARED_REFERENCE(retainRuntimeScheduler, releaseRuntimeScheduler);',
  '};',
);

fs.writeFileSync(HEADER, src);
console.log('[patch-expo-jsi] RuntimeScheduler.h patched for Xcode 26.3+');
