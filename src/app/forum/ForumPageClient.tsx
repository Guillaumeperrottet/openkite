"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageCircle,
  MapPin,
  Wind,
  Sailboat,
  HelpCircle,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  GripVertical,
} from "lucide-react";

const ICONS: Record<string, React.ReactNode> = {
  HelpCircle: <HelpCircle className="h-4 w-4" />,
  MapPin: <MapPin className="h-4 w-4" />,
  Wind: <Wind className="h-4 w-4" />,
  Sailboat: <Sailboat className="h-4 w-4" />,
  MessageCircle: <MessageCircle className="h-4 w-4" />,
};

const ICON_OPTIONS = [
  "MessageCircle",
  "MapPin",
  "Wind",
  "Sailboat",
  "HelpCircle",
];

interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  order: number;
  topicCount: number;
  lastTopic: { title: string; authorName: string } | null;
}

interface Props {
  categories: CategoryData[];
  isAdmin?: boolean;
}

export function ForumPageClient({ categories, isAdmin }: Props) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="mx-auto px-4 sm:px-6 lg:px-10 pt-20 pb-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Forum</h1>
        {isAdmin && (
          <button
            onClick={() => setShowNew(!showNew)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nouvelle catégorie</span>
          </button>
        )}
      </div>

      {showNew && (
        <div className="mb-4 p-4 border border-gray-200 rounded-md bg-white">
          <NewCategoryForm
            onDone={() => {
              setShowNew(false);
              router.refresh();
            }}
            onCancel={() => setShowNew(false)}
          />
        </div>
      )}

      <div className="divide-y divide-gray-200 border border-gray-200 rounded-md bg-white">
        {categories.map((cat) =>
          editingId === cat.id ? (
            <EditCategoryRow
              key={cat.id}
              category={cat}
              onDone={() => {
                setEditingId(null);
                router.refresh();
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div key={cat.id} className="flex items-center group">
              <Link
                href={`/forum/${cat.slug}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors flex-1 min-w-0"
              >
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 text-gray-500 shrink-0">
                  {ICONS[cat.icon ?? "MessageCircle"] ?? (
                    <MessageCircle className="h-4 w-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-medium text-gray-900 group-hover:underline">
                    {cat.name}
                  </h2>
                  {cat.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {cat.description}
                    </p>
                  )}
                </div>

                <div className="text-xs text-gray-400 shrink-0 hidden sm:block tabular-nums">
                  {cat.topicCount} sujet{cat.topicCount !== 1 ? "s" : ""}
                </div>

                {cat.lastTopic && (
                  <div className="text-right shrink-0 hidden md:block max-w-50">
                    <div className="text-xs text-gray-600 truncate">
                      {cat.lastTopic.title}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {cat.lastTopic.authorName}
                    </div>
                  </div>
                )}
              </Link>

              {isAdmin && (
                <div className="flex items-center gap-1 pr-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => setEditingId(cat.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="Modifier"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        !confirm(
                          `Supprimer « ${cat.name} » et tous ses sujets ?`,
                        )
                      )
                        return;
                      const res = await fetch(
                        `/api/forum/categories/${cat.id}`,
                        { method: "DELETE" },
                      );
                      if (res.ok) router.refresh();
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ),
        )}

        {categories.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucune catégorie</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── New Category Form ─────────────────────────────── */

function NewCategoryForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("MessageCircle");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/forum/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, icon }),
    });
    setSaving(false);
    if (res.ok) onDone();
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Nom
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom de la catégorie"
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:border-gray-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Description
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description courte (optionnel)"
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:border-gray-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Icône
        </label>
        <div className="flex items-center gap-2">
          {ICON_OPTIONS.map((ic) => (
            <button
              key={ic}
              onClick={() => setIcon(ic)}
              className={`p-2 rounded border transition-colors ${
                icon === ic
                  ? "border-gray-400 bg-gray-100"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {ICONS[ic]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white text-sm rounded hover:bg-gray-900 transition-colors disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          {saving ? "Création…" : "Créer"}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 text-sm rounded hover:bg-gray-100 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Annuler
        </button>
      </div>
    </div>
  );
}

/* ── Edit Category Row ─────────────────────────────── */

function EditCategoryRow({
  category,
  onDone,
  onCancel,
}: {
  category: CategoryData;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? "");
  const [icon, setIcon] = useState(category.icon ?? "MessageCircle");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/forum/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, icon }),
    });
    setSaving(false);
    if (res.ok) onDone();
  };

  return (
    <div className="px-4 py-3 space-y-2 bg-gray-50">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-gray-400"
        />
      </div>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        className="w-full border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-gray-400"
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Icône :</span>
        {ICON_OPTIONS.map((ic) => (
          <button
            key={ic}
            onClick={() => setIcon(ic)}
            className={`p-1.5 rounded border transition-colors ${
              icon === ic
                ? "border-gray-400 bg-gray-100"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            {ICONS[ic]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1 px-2.5 py-1 bg-gray-800 text-white text-xs rounded hover:bg-gray-900 transition-colors disabled:opacity-50"
        >
          <Check className="h-3 w-3" />
          {saving ? "…" : "Enregistrer"}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-2.5 py-1 text-gray-500 text-xs rounded hover:bg-gray-100 transition-colors"
        >
          <X className="h-3 w-3" />
          Annuler
        </button>
      </div>
    </div>
  );
}
