import type { InventoryGroup } from '@workspace/client-sdk';
import { Check, Edit3, FolderPlus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

export function GroupManager({
  groups,
  busy,
  onCreate,
  onRename,
  onDelete,
}: {
  groups: InventoryGroup[];
  busy: boolean;
  onCreate(name: string): Promise<void>;
  onRename(group: InventoryGroup, name: string): Promise<void>;
  onDelete(group: InventoryGroup): Promise<void>;
}): React.JSX.Element {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  return (
    <div className="inventory-group-manager">
      <form
        className="inventory-group-create"
        onSubmit={(event) => {
          event.preventDefault();
          const name = newName.trim();
          if (!name || busy) return;
          void onCreate(name)
            .then(() => setNewName(''))
            .catch(() => undefined);
        }}
      >
        <label className="field">
          <span>新分组名称</span>
          <input
            autoFocus
            maxLength={80}
            value={newName}
            placeholder="例如：收纳箱"
            onChange={(event) => setNewName(event.target.value)}
          />
        </label>
        <button type="submit" className="button button--accent" disabled={!newName.trim() || busy}>
          <FolderPlus aria-hidden="true" size={17} />
          添加分组
        </button>
      </form>
      <div className="inventory-group-list">
        {groups.length ? (
          groups.map((group) => (
            <article key={group.id} className="inventory-group-row">
              {editingId === group.id ? (
                <input
                  aria-label={`重命名${group.name}`}
                  maxLength={80}
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                />
              ) : (
                <div>
                  <strong>{group.name}</strong>
                  <span>
                    {group.itemCount} 种 · {group.totalQuantity} 件
                  </span>
                </div>
              )}
              <div className="inventory-group-row__actions">
                {editingId === group.id ? (
                  <>
                    <button
                      type="button"
                      className="icon-button icon-button--small"
                      aria-label={`保存${group.name}名称`}
                      disabled={!editingName.trim() || busy}
                      onClick={() => {
                        void onRename(group, editingName.trim())
                          .then(() => setEditingId(null))
                          .catch(() => undefined);
                      }}
                    >
                      <Check aria-hidden="true" size={17} />
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-button--small"
                      aria-label="取消重命名"
                      onClick={() => setEditingId(null)}
                    >
                      <X aria-hidden="true" size={17} />
                    </button>
                  </>
                ) : deletingId === group.id ? (
                  <>
                    <span className="inventory-group-delete-copy">物品移至无分组</span>
                    <button
                      type="button"
                      className="button button--danger"
                      disabled={busy}
                      onClick={() => {
                        void onDelete(group)
                          .then(() => setDeletingId(null))
                          .catch(() => undefined);
                      }}
                    >
                      确认删除
                    </button>
                    <button
                      type="button"
                      className="button button--quiet"
                      onClick={() => setDeletingId(null)}
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="icon-button icon-button--small"
                      aria-label={`重命名${group.name}`}
                      onClick={() => {
                        setEditingId(group.id);
                        setEditingName(group.name);
                      }}
                    >
                      <Edit3 aria-hidden="true" size={17} />
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-button--small"
                      aria-label={`删除${group.name}`}
                      onClick={() => setDeletingId(group.id)}
                    >
                      <Trash2 aria-hidden="true" size={17} />
                    </button>
                  </>
                )}
              </div>
            </article>
          ))
        ) : (
          <p className="inventory-group-empty">还没有分组。物品仍可直接保存为“无分组”。</p>
        )}
      </div>
    </div>
  );
}
