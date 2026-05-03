type ComparableSubmission<TSubmission, TContent> = {
  submission: TSubmission & { id: string };
  content: TContent;
};

export function buildInternalComparisonPairs<
  TSubmission extends { id: string },
  TContent,
>(
  comparableSubmissions: Array<ComparableSubmission<TSubmission, TContent>>,
  requestedSubmissionIds: ReadonlySet<string>,
) {
  const pairs: Array<{
    left: ComparableSubmission<TSubmission, TContent>;
    right: ComparableSubmission<TSubmission, TContent>;
  }> = [];

  for (let leftIndex = 0; leftIndex < comparableSubmissions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < comparableSubmissions.length; rightIndex += 1) {
      const left = comparableSubmissions[leftIndex];
      const right = comparableSubmissions[rightIndex];

      if (
        requestedSubmissionIds.size > 0 &&
        !requestedSubmissionIds.has(left.submission.id) &&
        !requestedSubmissionIds.has(right.submission.id)
      ) {
        continue;
      }

      pairs.push({ left, right });
    }
  }

  return pairs;
}
