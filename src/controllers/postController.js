const Post = require('../models/Post');
const { NotFoundError, ForbiddenError, ValidationError } = require('../utils/errors');

/**
 * Express's query parser turns ?tag=a&tag=b into an array and ?tag[$ne]=x
 * into an object. Only a plain string is a meaningful filter, so anything
 * else is a 400 rather than a TypeError (500) or an operator object passed
 * straight into the Mongo query.
 */
function optionalStringParam(query, name) {
  const value = query[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new ValidationError(`${name} must be a single string value`);
  }
  return value;
}

async function listPosts(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 0, 0);
    const size = Math.min(Math.max(parseInt(req.query.size, 10) || 10, 1), 50);

    const tag = optionalStringParam(req.query, 'tag');
    const search = optionalStringParam(req.query, 'search');

    const filter = {};
    if (tag) {
      filter.tags = tag.toLowerCase();
    }
    if (search) {
      filter.$text = { $search: search };
    }

    const [posts, totalElements] = await Promise.all([
      Post.find(filter)
        .select('-comments') // list view doesn't need the full comment thread
        .sort({ createdAt: -1 })
        .skip(page * size)
        .limit(size),
      Post.countDocuments(filter),
    ]);

    res.json({
      content: posts,
      currentPage: page,
      pageSize: size,
      totalElements,
      totalPages: Math.ceil(totalElements / size),
    });
  } catch (err) {
    next(err);
  }
}

async function getPostById(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) throw new NotFoundError(`Post not found with id: ${req.params.id}`);
    res.json(post);
  } catch (err) {
    next(err);
  }
}

async function createPost(req, res, next) {
  try {
    const { title, body, tags } = req.body;
    if (!title || !body) {
      return res.status(400).json({ message: 'title and body are required' });
    }

    const post = await Post.create({
      title,
      body,
      tags: tags || [],
      author: req.user.id,
      authorUsername: req.user.username,
    });

    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
}

async function updatePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) throw new NotFoundError(`Post not found with id: ${req.params.id}`);

    if (post.author.toString() !== req.user.id) {
      throw new ForbiddenError('You can only edit your own posts');
    }

    const { title, body, tags } = req.body;
    if (title !== undefined) post.title = title;
    if (body !== undefined) post.body = body;
    if (tags !== undefined) post.tags = tags;

    await post.save();
    res.json(post);
  } catch (err) {
    next(err);
  }
}

async function deletePost(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) throw new NotFoundError(`Post not found with id: ${req.params.id}`);

    if (post.author.toString() !== req.user.id) {
      throw new ForbiddenError('You can only delete your own posts');
    }

    await post.deleteOne();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function addComment(req, res, next) {
  try {
    const { body } = req.body;
    if (!body) return res.status(400).json({ message: 'body is required' });

    const post = await Post.findById(req.params.id);
    if (!post) throw new NotFoundError(`Post not found with id: ${req.params.id}`);

    post.comments.push({
      body,
      author: req.user.id,
      authorUsername: req.user.username,
      replies: [],
    });

    await post.save();
    res.status(201).json(post.comments[post.comments.length - 1]);
  } catch (err) {
    next(err);
  }
}

async function addReply(req, res, next) {
  try {
    const { body } = req.body;
    if (!body) return res.status(400).json({ message: 'body is required' });

    const post = await Post.findById(req.params.id);
    if (!post) throw new NotFoundError(`Post not found with id: ${req.params.id}`);

    const comment = post.comments.id(req.params.commentId);
    if (!comment) throw new NotFoundError(`Comment not found with id: ${req.params.commentId}`);

    comment.replies.push({
      body,
      author: req.user.id,
      authorUsername: req.user.username,
    });

    await post.save();
    res.status(201).json(comment.replies[comment.replies.length - 1]);
  } catch (err) {
    next(err);
  }
}

async function deleteComment(req, res, next) {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) throw new NotFoundError(`Post not found with id: ${req.params.id}`);

    const comment = post.comments.id(req.params.commentId);
    if (!comment) throw new NotFoundError(`Comment not found with id: ${req.params.commentId}`);

    if (comment.author.toString() !== req.user.id) {
      throw new ForbiddenError('You can only delete your own comments');
    }

    comment.deleteOne();
    await post.save();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * Ranks posts by total engagement (top-level comments + nested replies)
 * using an aggregation pipeline -- the kind of query that's awkward in a
 * relational schema (would need a join + group-by across a separate
 * comments table) but falls out naturally here since comments/replies are
 * already embedded in the post document.
 */
async function getTrendingPosts(req, res, next) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);

    const posts = await Post.aggregate([
      {
        $addFields: {
          commentCount: { $size: '$comments' },
          replyCount: {
            $sum: {
              $map: {
                input: '$comments',
                as: 'c',
                in: { $size: '$$c.replies' },
              },
            },
          },
        },
      },
      {
        $addFields: {
          engagementScore: { $add: ['$commentCount', '$replyCount'] },
        },
      },
      { $sort: { engagementScore: -1, createdAt: -1 } },
      { $limit: limit },
      {
        $project: {
          title: 1,
          tags: 1,
          authorUsername: 1,
          createdAt: 1,
          commentCount: 1,
          replyCount: 1,
          engagementScore: 1,
        },
      },
    ]);

    res.json(posts);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  addComment,
  addReply,
  deleteComment,
  getTrendingPosts,
};
