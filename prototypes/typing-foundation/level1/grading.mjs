export function getPolicy(grade, starter = false, lesson = null) {
  if (!['3', '6'].includes(String(grade))) throw new RangeError('Unknown grade');
  return {
    practiceAccuracy: 90, challengeAccuracy: 95, confirmations: 2,
    speed: String(grade) === '6' && !starter ? (lesson?.speed ?? 12) : (lesson?.starterSpeed ?? 8),
    stretchSpeed: String(grade) === '6' ? (lesson?.speed ?? 12)+3 : 12,
  };
}

export function evaluateAttempt({ correct, errors, elapsedMs, challenge, interrupted, policy }) {
  const accuracy = correct + errors > 0 ? correct / (correct + errors) * 100 : 0;
  // Only correctly completed target keys count toward speed. Mistakes cost time
  // and lower accuracy, rather than increasing gross WPM through random presses.
  const wpm = elapsedMs > 0 ? correct / 5 / (elapsedMs / 60000) : 0;
  const accuracyPassed = accuracy >= (challenge ? policy.challengeAccuracy : policy.practiceAccuracy);
  const speedPassed = !challenge || wpm >= policy.speed;
  const eligible = !challenge || !interrupted;
  return { accuracy, wpm, accuracyPassed, speedPassed, eligible,
    passed: correct > 0 && accuracyPassed && speedPassed && eligible };
}

export function createClock(now = () => performance.now()) {
  let runningAt = null, accumulated = 0, started = false;
  return {
    start() { if (!started) { started = true; runningAt = now(); } },
    pause() { if (runningAt !== null) { accumulated += now() - runningAt; runningAt = null; } },
    resume() { if (started && runningAt === null) runningAt = now(); },
    elapsed() { return accumulated + (runningAt === null ? 0 : now() - runningAt); },
  };
}
