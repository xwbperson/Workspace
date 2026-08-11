import type {
  Book,
  BookChapter,
  BookChapterInput,
  BookInput,
  BookReadingStatus,
} from '@workspace/client-sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArrowLeft,
  BookOpen,
  Camera,
  Edit3,
  Library,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal.js';
import { PageTopbarActions } from '../../components/ui/PageTopbarActions.js';
import { EmptyState, SectionError } from '../../components/ui/States.js';
import { useToast } from '../../components/ui/ToastProvider.js';
import { humanizeApiError } from '../../platform/api/client.js';
import { bookApi, bookKeys, invalidateBookData } from './api.js';
import { BookForm, readingStatusLabels } from './components/BookForm.js';
import { ChapterForm } from './components/ChapterForm.js';
import { ProgressBar } from './components/ProgressBar.js';

type BookFilter = 'all' | BookReadingStatus | 'archived';

export function BookPage(): React.JSX.Element {
  const { bookId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<BookFilter>('all');
  const [createOpen, setCreateOpen] = useState(params.get('create') === '1');
  const [editOpen, setEditOpen] = useState(false);
  const [chapterOpen, setChapterOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [chapterToEdit, setChapterToEdit] = useState<BookChapter>();
  const [chapterToDelete, setChapterToDelete] = useState<BookChapter>();

  const list = useQuery({
    queryKey: bookKeys.list(filter),
    queryFn: () =>
      bookApi.list(
        filter === 'archived'
          ? { archived: true }
          : filter === 'all'
            ? { archived: false }
            : { archived: false, readingStatus: filter },
      ),
  });
  const detail = useQuery({
    queryKey: bookKeys.detail(bookId ?? ''),
    queryFn: () => bookApi.get(bookId!),
    enabled: Boolean(bookId),
  });
  const selected = detail.data ?? list.data?.items.find((book) => book.id === bookId);
  const ordered = useMemo(() => list.data?.items ?? [], [list.data]);

  const create = useMutation({
    mutationFn: (input: BookInput) => bookApi.create(input),
    onSuccess: async (book) => {
      await invalidateBookData();
      setCreateOpen(false);
      show('书籍已添加');
      void navigate(`/features/books/${book.id}`, { replace: true });
    },
  });
  const update = useMutation({
    mutationFn: ({ book, input }: { book: Book; input: BookInput }) =>
      bookApi.update(book.id, { ...input, version: book.version }),
    onSuccess: async () => {
      await invalidateBookData();
      setEditOpen(false);
      show('书籍已更新');
    },
  });
  const createChapter = useMutation({
    mutationFn: ({ book, input }: { book: Book; input: BookChapterInput }) =>
      bookApi.createChapter(book.id, input),
    onSuccess: async () => {
      await invalidateBookData();
      setChapterOpen(false);
      setChapterToEdit(undefined);
      show('章节已添加');
    },
  });
  const updateChapter = useMutation({
    mutationFn: ({
      book,
      chapter,
      input,
    }: {
      book: Book;
      chapter: BookChapter;
      input: BookChapterInput;
    }) => bookApi.updateChapter(book.id, chapter.id, { ...input, version: chapter.version }),
    onSuccess: async () => {
      await invalidateBookData();
      setChapterOpen(false);
      setChapterToEdit(undefined);
      show('章节已更新');
    },
  });
  const deleteChapter = useMutation({
    mutationFn: ({ book, chapter }: { book: Book; chapter: BookChapter }) =>
      bookApi.deleteChapter(book.id, chapter.id, chapter.version),
    onSuccess: async () => {
      await invalidateBookData();
      setChapterToDelete(undefined);
      show('章节已删除');
    },
  });
  const archive = useMutation({
    mutationFn: (book: Book) => bookApi.archive(book.id, book.version),
    onSuccess: async () => {
      await invalidateBookData();
      setArchiveOpen(false);
      show('书籍已归档');
      void navigate('/features/books', { replace: true });
    },
  });
  const restore = useMutation({
    mutationFn: (book: Book) => bookApi.restore(book.id, book.version),
    onSuccess: async () => {
      await invalidateBookData();
      setFilter('all');
      show('书籍已恢复');
      void navigate('/features/books', { replace: true });
    },
  });
  const permanentDelete = useMutation({
    mutationFn: (book: Book) => bookApi.deletePermanently(book.id, book.version),
    onSuccess: async () => {
      await invalidateBookData();
      setDeleteOpen(false);
      show('书籍已永久删除');
      void navigate('/features/books', { replace: true });
    },
  });
  const uploadCover = useMutation({
    mutationFn: async ({ book, file }: { book: Book; file: File }) => {
      if (!file.type.startsWith('image/')) throw new Error('封面必须是图片文件。');
      const stored = await bookApi.uploadFile(file);
      return bookApi.update(book.id, { coverFileId: stored.id, version: book.version });
    },
    onSuccess: async () => {
      await invalidateBookData();
      show('书封已更新');
    },
  });

  const mutationError =
    create.error ??
    update.error ??
    createChapter.error ??
    updateChapter.error ??
    deleteChapter.error ??
    archive.error ??
    restore.error ??
    permanentDelete.error ??
    uploadCover.error;

  const changeFilter = (value: BookFilter): void => {
    setFilter(value);
    void navigate('/features/books');
  };

  return (
    <div className="library-page page-stack">
      <PageTopbarActions>
        <button
          className="button button--primary"
          type="button"
          onClick={() => setCreateOpen(true)}
        >
          <Plus aria-hidden="true" size={18} /> <span>添加书籍</span>
        </button>
      </PageTopbarActions>

      {mutationError ? (
        <SectionError title="操作没有完成" message={humanizeApiError(mutationError)} />
      ) : null}

      <div className="learning-filter" aria-label="书籍状态">
        {(
          [
            ['all', '全部'],
            ['to-read', '待读'],
            ['reading', '在读'],
            ['read', '已读'],
            ['abandoned', '放弃'],
            ['archived', '已归档'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filter === value ? 'active' : ''}
            onClick={() => changeFilter(value)}
          >
            {label}
          </button>
        ))}
        <span>{ordered.length} 本</span>
      </div>

      <div className={`learning-workspace ${selected ? 'learning-workspace--detail' : ''}`}>
        <section className="learning-list-panel" aria-label="书籍列表">
          {list.isError ? (
            <SectionError
              message={humanizeApiError(list.error)}
              onRetry={() => void list.refetch()}
            />
          ) : list.isLoading ? (
            <div className="skeleton-list">
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : ordered.length ? (
            <div className="book-card-grid">
              {ordered.map((book) => (
                <Link
                  key={book.id}
                  className={`book-card ${book.id === bookId ? 'active' : ''}`}
                  to={`/features/books/${book.id}`}
                >
                  <div className="book-card__cover">
                    {book.cover ? (
                      <img src={book.cover.contentUrl} alt={`${book.title}封面`} />
                    ) : (
                      <Library aria-hidden="true" />
                    )}
                  </div>
                  <div className="book-card__body">
                    <span className="source-pill">
                      {book.archived ? '已归档' : readingStatusLabels[book.readingStatus]}
                    </span>
                    <strong>{book.title}</strong>
                    <small>{book.author || '未填写作者'}</small>
                    <ProgressBar progress={book.progress} compact />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title={filter === 'archived' ? '还没有已归档书籍' : '还没有符合条件的书籍'}
              description={
                filter === 'archived'
                  ? '归档后的书籍会出现在这里。'
                  : '添加第一本书，再用章节记录实际阅读进度。'
              }
              action={
                filter !== 'archived' ? (
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={() => setCreateOpen(true)}
                  >
                    添加书籍
                  </button>
                ) : undefined
              }
            />
          )}
        </section>

        <section className="learning-detail-panel">
          {detail.isLoading && bookId ? (
            <div className="skeleton skeleton--detail" />
          ) : detail.isError ? (
            <SectionError
              message={humanizeApiError(detail.error)}
              onRetry={() => void detail.refetch()}
            />
          ) : selected ? (
            <BookDetail
              book={selected}
              onBack={() => void navigate('/features/books')}
              onEdit={() => setEditOpen(true)}
              onAddChapter={() => {
                setChapterToEdit(undefined);
                setChapterOpen(true);
              }}
              onEditChapter={(chapter) => {
                setChapterToEdit(chapter);
                setChapterOpen(true);
              }}
              onDeleteChapter={setChapterToDelete}
              onArchive={() => setArchiveOpen(true)}
              onRestore={() => restore.mutate(selected)}
              onDeletePermanently={() => setDeleteOpen(true)}
              onPickCover={() => fileInput.current?.click()}
            />
          ) : (
            <div className="learning-detail-empty">
              <BookOpen aria-hidden="true" />
              <h3>选择一本书</h3>
              <p>书籍信息、章节和进度会显示在这里。</p>
            </div>
          )}
        </section>
      </div>

      <input
        ref={fileInput}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (selected && file) uploadCover.mutate({ book: selected, file });
          event.target.value = '';
        }}
      />

      <Modal
        open={createOpen}
        title="添加书籍"
        description="先建立书目，之后可添加封面和章节。"
        onClose={() => setCreateOpen(false)}
        className="modal--wide"
      >
        <BookForm
          submitting={create.isPending}
          onSubmit={(input) => create.mutateAsync(input).then(() => undefined)}
        />
      </Modal>
      <Modal
        open={editOpen}
        title="编辑书籍"
        onClose={() => setEditOpen(false)}
        className="modal--wide"
      >
        {selected ? (
          <BookForm
            key={`${selected.id}:${selected.version}`}
            book={selected}
            submitting={update.isPending}
            onSubmit={(input) =>
              update.mutateAsync({ book: selected, input }).then(() => undefined)
            }
          />
        ) : null}
      </Modal>
      <Modal
        open={chapterOpen}
        title={chapterToEdit ? '编辑章节' : '添加章节'}
        description="页码范围不能与已有章节重叠。"
        onClose={() => {
          setChapterOpen(false);
          setChapterToEdit(undefined);
        }}
      >
        {selected ? (
          <ChapterForm
            key={chapterToEdit?.id ?? `new:${selected.chapterCount}`}
            {...(chapterToEdit ? { chapter: chapterToEdit } : {})}
            defaultStartPage={
              Math.max(0, ...(selected.chapters ?? []).map((chapter) => chapter.endPage)) + 1
            }
            submitting={createChapter.isPending || updateChapter.isPending}
            onSubmit={(input) =>
              chapterToEdit
                ? updateChapter
                    .mutateAsync({ book: selected, chapter: chapterToEdit, input })
                    .then(() => undefined)
                : createChapter.mutateAsync({ book: selected, input }).then(() => undefined)
            }
          />
        ) : null}
      </Modal>
      <ConfirmModal
        open={archiveOpen}
        title="归档书籍"
        text={`归档“${selected?.title ?? ''}”后，封面、章节和进度仍会保留。`}
        confirmLabel="确认归档"
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => selected && archive.mutate(selected)}
      />
      <ConfirmModal
        open={deleteOpen}
        danger
        title="永久删除书籍"
        text={`确定永久删除“${selected?.title ?? ''}”吗？章节和阅读进度也会删除，无法恢复。`}
        confirmLabel="确认永久删除"
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => selected && permanentDelete.mutate(selected)}
      />
      <ConfirmModal
        open={Boolean(chapterToDelete)}
        danger
        title="删除章节"
        text={`确定删除“${chapterToDelete?.title ?? ''}”及其页码进度吗？`}
        confirmLabel="删除章节"
        onClose={() => setChapterToDelete(undefined)}
        onConfirm={() =>
          selected &&
          chapterToDelete &&
          deleteChapter.mutate({ book: selected, chapter: chapterToDelete })
        }
      />
    </div>
  );
}

function BookDetail({
  book,
  onBack,
  onEdit,
  onAddChapter,
  onEditChapter,
  onDeleteChapter,
  onArchive,
  onRestore,
  onDeletePermanently,
  onPickCover,
}: {
  book: Book;
  onBack(): void;
  onEdit(): void;
  onAddChapter(): void;
  onEditChapter(chapter: BookChapter): void;
  onDeleteChapter(chapter: BookChapter): void;
  onArchive(): void;
  onRestore(): void;
  onDeletePermanently(): void;
  onPickCover(): void;
}): React.JSX.Element {
  return (
    <article className="learning-detail">
      <button type="button" className="button button--text learning-mobile-back" onClick={onBack}>
        <ArrowLeft aria-hidden="true" /> 返回书库
      </button>
      <header className="book-detail-header">
        <div className="book-detail-cover">
          {book.cover ? (
            <img src={book.cover.contentUrl} alt={`${book.title}封面`} />
          ) : (
            <Library aria-hidden="true" />
          )}
          {!book.archived ? (
            <button type="button" onClick={onPickCover}>
              <Camera aria-hidden="true" size={16} /> 更换封面
            </button>
          ) : null}
        </div>
        <div className="book-detail-title">
          <span className={`source-pill ${book.archived ? 'source-pill--archived' : ''}`}>
            {book.archived ? '已归档' : readingStatusLabels[book.readingStatus]}
          </span>
          <h2>{book.title}</h2>
          {book.subtitle ? <p>{book.subtitle}</p> : null}
          <strong>{book.author || '未填写作者'}</strong>
          <ProgressBar progress={book.progress} />
          <div className="learning-actions">
            {book.archived ? (
              <>
                <button type="button" className="button button--primary" onClick={onRestore}>
                  <RotateCcw aria-hidden="true" /> 恢复
                </button>
                <button
                  type="button"
                  className="button button--danger"
                  onClick={onDeletePermanently}
                >
                  <Trash2 aria-hidden="true" /> 永久删除
                </button>
              </>
            ) : (
              <>
                <button type="button" className="button button--primary" onClick={onEdit}>
                  <Edit3 aria-hidden="true" /> 编辑书籍
                </button>
                <button type="button" className="button button--quiet" onClick={onArchive}>
                  <Archive aria-hidden="true" /> 归档
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="learning-section">
        <div className="learning-section__heading">
          <div>
            <p className="eyebrow">书目信息</p>
            <h3>出版与识别信息</h3>
          </div>
        </div>
        <dl className="metadata-grid">
          <div>
            <dt>ISBN</dt>
            <dd>{book.isbn || '未填写'}</dd>
          </div>
          <div>
            <dt>版本</dt>
            <dd>{book.edition || '未填写'}</dd>
          </div>
          <div>
            <dt>出版社</dt>
            <dd>{book.publisher || '未填写'}</dd>
          </div>
          <div>
            <dt>出版日期</dt>
            <dd>{book.publishDate || '未填写'}</dd>
          </div>
          <div>
            <dt>语言</dt>
            <dd>{book.language || '未填写'}</dd>
          </div>
          <div>
            <dt>载体</dt>
            <dd>{book.format || '未填写'}</dd>
          </div>
        </dl>
        {book.description ? <p className="long-copy">{book.description}</p> : null}
      </section>

      <section className="learning-section">
        <div className="learning-section__heading">
          <div>
            <p className="eyebrow">章节</p>
            <h3>{book.chapterCount} 个章节</h3>
          </div>
          {!book.archived ? (
            <button type="button" className="button button--primary" onClick={onAddChapter}>
              <Plus aria-hidden="true" /> 添加章节
            </button>
          ) : null}
        </div>
        {book.chapters?.length ? (
          <div className="chapter-list">
            {book.chapters.map((chapter) => (
              <article key={chapter.id} className="chapter-item">
                <Link to={`/features/books/${book.id}/chapters/${chapter.id}`}>
                  <strong>{chapter.title}</strong>
                  <span>
                    {chapter.startPage}-{chapter.endPage} 页 · 已读到{' '}
                    {chapter.currentPage < chapter.startPage ? '未开始' : chapter.currentPage}
                  </span>
                </Link>
                <ProgressBar progress={chapter} compact />
                {!book.archived ? (
                  <div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`编辑${chapter.title}`}
                      onClick={() => onEditChapter(chapter)}
                    >
                      <Edit3 aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-button--danger"
                      aria-label={`删除${chapter.title}`}
                      onClick={() => onDeleteChapter(chapter)}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="还没有章节"
            description="添加章节后，可以记录每章页码并自动汇总整书进度。"
          />
        )}
      </section>

      {book.notes ? (
        <section className="learning-section">
          <div className="learning-section__heading">
            <div>
              <p className="eyebrow">阅读笔记</p>
              <h3>整书记录</h3>
            </div>
          </div>
          <p className="long-copy">{book.notes}</p>
        </section>
      ) : null}
    </article>
  );
}

function ConfirmModal({
  open,
  title,
  text,
  confirmLabel,
  danger = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  onClose(): void;
  onConfirm(): void;
}): React.JSX.Element {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--quiet" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={`button ${danger ? 'button--danger' : 'button--primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p>{text}</p>
    </Modal>
  );
}
