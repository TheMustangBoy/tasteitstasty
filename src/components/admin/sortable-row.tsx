import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

/**
 * Sortierbare Produktkarte für die Admin-Produktverwaltung.
 * Der Drag-Handle ist tastatur- und touchfähig (@dnd-kit).
 */
export function SortableRow({
  id,
  disabled = false,
  label,
  children,
}: {
  id: string;
  disabled?: boolean;
  label: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-2xl border bg-card p-4 sm:p-5 ${
        isDragging ? "z-10 border-primary opacity-70 shadow-flame" : "border-border"
      }`}
    >
      {children(
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={disabled}
          aria-label={`„${label}“ sortieren – ziehen oder mit Leertaste und Pfeiltasten verschieben`}
          title="Zum Sortieren ziehen"
          className="mt-1 touch-none cursor-grab rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
        >
          <GripVertical className="h-5 w-5" />
        </button>,
      )}
    </div>
  );
}
