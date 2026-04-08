"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Pin,
  Lock,
  Trash2,
  Share2,
  MessageSquare,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { VoteButtons } from "@/components/forum/VoteButtons";
import { PostThread } from "@/components/forum/PostThread";
import type { PostNode } from "@/components/forum/PostThread";
import { ReplyForm } from "@/components/forum/ReplyForm";
import { Markdown } from "@/components/forum/Markdown";
import { useFavContext } from "@/lib/FavContext";
import { timeAgo } from "@/lib/forum";

interface TopicData {
  id: string;
  title: string;
  slug: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  authorId: string;
  author: { id: string; name: string | null; avatarUrl: string | null };
  category: { id: string; name: string; slug: string };
  score: number;
  votes: { value: number; userId: string }[];
  createdAt: string;
  posts: PostNode[];
}

interface Props {
  topic: TopicData;
  categorySlug: string;
  isAdmin?: boolean;
}

export function TopicPageClient({ topic, categorySlug, isAdmin }: Props) {
  const { user } = useFavContext();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(topic.title);
  const [editBody, setEditBody] = useState(topic.body);
  const [saving, setSaving] = useState(false);

  const myVote = topic.votes.find((v) => v.userId === user?.id)?.value ?? null;

  const handleDelete = async () => {
    if (!confirm("Supprimer ce sujet ?")) return;
    const res = await fetch(`/api/forum/topics/${topic.id}`, {
      method: "DELETE",
    });
    if (res.ok) router.push(`/forum/${categorySlug}`);
  };

  const handleEdit = async () => {
    setSaving(true);
    const res = await fetch(`/api/forum/topics/${topic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, body: editBody }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
  };

  const handlePin = async () => {
    await fetch(`/api/forum/topics/${topic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !topic.pinned }),
    });
    router.refresh();
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  const refresh = () => router.refresh();

  return (
    <div className="mx-auto px-4 sm:px-6 lg:px-10 pt-20 pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3 flex-wrap">
        <Link href="/forum" className="hover:text-gray-600 transition-colors">
          Forum
        </Link>
        <span>/</span>
        <Link
          href={`/forum/${categorySlug}`}
          className="hover:text-gray-600 transition-colors"
        >
          {topic.category.name}
        </Link>
      </div>

      {/* Topic title */}
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {topic.pinned && <Pin className="h-3.5 w-3.5 text-gray-400" />}
          {topic.locked && <Lock className="h-3.5 w-3.5 text-gray-400" />}
          {editing ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-lg font-semibold text-gray-900 outline-none focus:border-gray-400"
            />
          ) : (
            <h1 className="text-lg font-semibold text-gray-900 wrap-break-words">
              {topic.title}
            </h1>
          )}
        </div>
      </div>

      {/* OP post — Reddit style */}
      <div className="flex gap-2">
        {/* Vote column */}
        <div className="shrink-0 pt-1">
          <VoteButtons
            topicId={topic.id}
            score={topic.score}
            userVote={myVote}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Author line */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            {topic.author.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={topic.author.avatarUrl}
                alt=""
                className="h-5 w-5 rounded-full"
              />
            ) : (
              <div className="h-5 w-5 rounded-full bg-gray-200" />
            )}
            <span className="font-medium text-gray-700">
              {topic.author.name ?? "Anonyme"}
            </span>
            <span>·</span>
            <span>{timeAgo(topic.createdAt)}</span>
          </div>

          {/* Body */}
          {editing ? (
            <div className="mt-2">
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={8}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400 resize-y"
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleEdit}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white text-sm rounded hover:bg-gray-900 transition-colors disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditTitle(topic.title);
                    setEditBody(topic.body);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 text-sm rounded hover:bg-gray-100 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <Markdown>{topic.body}</Markdown>
            </div>
          )}

          {/* Actions bar */}
          <div className="flex items-center gap-0.5 mt-2 -ml-2">
            <button className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded transition-colors">
              <MessageSquare className="h-3.5 w-3.5" />
              {countAllPosts(topic.posts)} commentaire
              {countAllPosts(topic.posts) !== 1 ? "s" : ""}
            </button>

            <button
              onClick={handleShare}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" />
              Partager
            </button>

            {(user?.id === topic.authorId || isAdmin) && !editing && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Éditer
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </button>
              </>
            )}

            {isAdmin && !editing && (
              <button
                onClick={handlePin}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded transition-colors"
              >
                <Pin className="h-3.5 w-3.5" />
                {topic.pinned ? "Désépingler" : "Épingler"}
              </button>
            )}
          </div>
        </div>
      </div>

      <hr className="my-4 border-gray-200" />

      {/* Reply form */}
      {!topic.locked && (
        <div className="mb-4">
          <ReplyForm
            topicId={topic.id}
            placeholder="Ajouter un commentaire…"
            onCreated={refresh}
          />
        </div>
      )}

      {/* Comment thread */}
      {topic.posts.length > 0 && (
        <div className="space-y-0">
          {topic.posts.map((post) => (
            <PostThread
              key={post.id}
              post={post}
              topicId={topic.id}
              userId={user?.id}
              isAdmin={isAdmin}
              onPostCreated={refresh}
              onPostDeleted={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function countAllPosts(posts: PostNode[]): number {
  let count = posts.length;
  for (const p of posts) {
    count += countAllPosts(p.children);
  }
  return count;
}
