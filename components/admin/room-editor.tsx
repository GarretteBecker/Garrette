'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveRoom, deleteRoom, type ActionState } from '@/lib/actions/properties';
import { Card, Field, inputClass, textareaClass, EmptyState } from '@/components/ui';
import type { Room } from '@/lib/types/database';

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 rounded-lg bg-brandgreen-600 px-5 font-semibold text-white disabled:opacity-60"
    >
      {pending ? 'Saving…' : label}
    </button>
  );
}

export default function RoomEditor({
  propertyId,
  rooms,
}: {
  propertyId: string;
  rooms: Room[];
}) {
  const [editing, setEditing] = useState<Room | 'new' | null>(null);
  const [state, formAction] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const result = await saveRoom(prev, fd);
      if (result.ok) setEditing(null);
      return result;
    },
    {},
  );

  if (editing) {
    const room = editing === 'new' ? null : editing;
    return (
      <Card className="p-4">
        <h3 className="mb-3 font-semibold text-navy-800">
          {room ? 'Edit room' : 'Add a room'}
        </h3>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="property_id" value={propertyId} />
          {room ? <input type="hidden" name="id" value={room.id} /> : null}

          <Field label="Room name" htmlFor="name">
            <input
              id="name"
              name="name"
              required
              defaultValue={room?.name ?? ''}
              className={inputClass}
              placeholder="Primary Bathroom"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="room_type">
              <input
                id="room_type"
                name="room_type"
                defaultValue={room?.room_type ?? ''}
                className={inputClass}
                placeholder="Bathroom"
              />
            </Field>
            <Field label="Floor" htmlFor="floor">
              <input
                id="floor"
                name="floor"
                defaultValue={room?.floor ?? ''}
                className={inputClass}
                placeholder="Upper"
              />
            </Field>
          </div>

          <Field label="Notes" htmlFor="notes">
            <textarea
              id="notes"
              name="notes"
              defaultValue={room?.notes ?? ''}
              className={textareaClass}
            />
          </Field>

          <input type="hidden" name="sort_order" value={room?.sort_order ?? rooms.length * 10 + 10} />

          {state.error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {state.error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <SaveButton label="Save room" />
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="h-12 rounded-lg px-4 font-medium text-slate-600 ring-1 ring-slate-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setEditing('new')}
        className="h-12 w-full rounded-lg bg-brandgreen-600 font-semibold text-white active:scale-[0.99]"
      >
        + Add room
      </button>

      {rooms.length === 0 ? (
        <EmptyState title="No rooms yet" hint="Add the rooms you inspect on a visit." />
      ) : (
        <ul className="space-y-2">
          {rooms.map((room) => (
            <li key={room.id}>
              <Card className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-800">{room.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {[room.room_type, room.floor].filter(Boolean).join(' • ') || 'No type set'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(room)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-navy-700 ring-1 ring-slate-300"
                >
                  Edit
                </button>
                <form action={deleteRoom}>
                  <input type="hidden" name="id" value={room.id} />
                  <input type="hidden" name="property_id" value={propertyId} />
                  <button
                    type="submit"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200"
                  >
                    Delete
                  </button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
