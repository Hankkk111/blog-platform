const mongoose = require('mongoose');

/**
 * Replies are nested one level inside a comment. We deliberately stop at
 * two levels (comment -> reply) rather than allowing infinite nesting --
 * unbounded recursive embedding makes documents unpredictable in size and
 * is rarely what a real UI needs anyway (most blog/forum UIs flatten
 * deeper threads visually even when the data model doesn't).
 */
const replySchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorUsername: { type: String, required: true }, // denormalized so reads don't need a populate()
    body: { type: String, required: [true, 'Reply body is required'], trim: true },
  },
  { timestamps: true }
);

const commentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorUsername: { type: String, required: true },
    body: { type: String, required: [true, 'Comment body is required'], trim: true },
    replies: [replySchema],
  },
  { timestamps: true }
);

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    body: {
      type: String,
      required: [true, 'Body is required'],
    },
    tags: {
      type: [String],
      default: [],
      // Normalize tags to lowercase so "React" and "react" are treated as
      // the same tag for filtering purposes. A single string is treated as
      // a one-tag list and null as no tags; non-string entries are left for
      // the String cast to reject as a validation error.
      set: (tags) => {
        if (tags == null) return [];
        const list = Array.isArray(tags) ? tags : [tags];
        return list
          .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : t))
          .filter((t) => t !== '');
      },
    },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorUsername: { type: String, required: true },
    comments: [commentSchema],
  },
  { timestamps: true }
);

// Full-text search across title and body (used by GET /api/posts?search=...)
postSchema.index({ title: 'text', body: 'text' });

// Speeds up tag-filter queries (GET /api/posts?tag=...)
postSchema.index({ tags: 1 });

module.exports = mongoose.model('Post', postSchema);
