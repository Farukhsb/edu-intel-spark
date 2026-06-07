export const redactStudentIdentity = (index: number) => ({
  studentName: `Student ${index + 1}`,
  studentEmail: `student-${index + 1}@redacted.local`,
});
