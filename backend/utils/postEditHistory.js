/**
 * Utilities for tracking post edit history and generating diffs.
 */

/**
 * Generate a simple line-by-line diff between two strings.
 * Returns an array of changed lines with type: 'modified', 'removed', or 'added'.
 *
 * @param {string} oldText - The original text
 * @param {string} newText - The updated text
 * @returns {Array<{lineNum: number, oldLine: string, newLine: string, type: string}>}
 */
function generateDiff(oldText, newText) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diff = [];

  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i] !== undefined ? oldLines[i] : '';
    const newLine = newLines[i] !== undefined ? newLines[i] : '';

    if (oldLine !== newLine) {
      diff.push({
        lineNum: i + 1,
        oldLine: oldLine || '(deleted)',
        newLine: newLine || '(deleted)',
        type: oldLine && newLine ? 'modified' : oldLine ? 'removed' : 'added'
      });
    }
  }

  return diff;
}

/**
 * Record an edit to a post's edit history and mark the post as edited.
 * Mutates the post object in place — caller must still call post.save().
 *
 * @param {object} post - Mongoose ForumPost document
 * @param {string} oldBody - The body text before the edit
 * @param {mongoose.Types.ObjectId|string} editedBy - User ID of the editor
 * @param {string} [reason='User edit'] - Optional reason for the edit
 */
function recordEdit(post, oldBody, editedBy, reason = 'User edit') {
  if (!post.editHistory) post.editHistory = [];

  post.editHistory.push({
    originalBody: oldBody,
    editedAt: new Date(),
    editedBy: editedBy,
    reason: reason
  });

  post.isEdited = true;
  post.lastEditedAt = new Date();
  post.lastEditedBy = editedBy;
}

module.exports = { generateDiff, recordEdit };
