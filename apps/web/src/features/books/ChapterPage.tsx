import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SectionError } from '../../components/ui/States.js';
import { useToast } from '../../components/ui/ToastProvider.js';
import { humanizeApiError } from '../../platform/api/client.js';
import { bookApi, bookKeys, invalidateBookData } from './api.js';
import { ProgressBar } from './components/ProgressBar.js';

export function ChapterPage(): React.JSX.Element {
  const { bookId = '', chapterId = '' } = useParams();
  const { show } = useToast();
  const book = useQuery({
    queryKey: bookKeys.detail(bookId),
    queryFn: () => bookApi.get(bookId),
    enabled: Boolean(bookId),
  });
  const chapter = useQuery({
    queryKey: bookKeys.chapter(bookId, chapterId),
    queryFn: () => bookApi.getChapter(bookId, chapterId),
    enabled: Boolean(bookId && chapterId),
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!chapter.data) return;
    setCurrentPage(chapter.data.currentPage);
    setNotes(chapter.data.notes);
  }, [chapter.data]);

  const save = useMutation({
    mutationFn: () =>
      bookApi.updateChapter(bookId, chapterId, {
        currentPage,
        notes,
        version: chapter.data!.version,
      }),
    onSuccess: async () => {
      await invalidateBookData();
      show('章节进度已保存');
    },
  });

  if (book.isError || chapter.isError || save.isError) {
    return (
      <SectionError
        title="章节暂时无法打开"
        message={humanizeApiError(book.error ?? chapter.error ?? save.error)}
      />
    );
  }
  if (!book.data || !chapter.data) return <div className="skeleton skeleton--detail" />;

  const previewProgress = {
    totalPages: chapter.data.totalPages,
    readPages: Math.max(
      0,
      Math.min(chapter.data.totalPages, currentPage - chapter.data.startPage + 1),
    ),
    percentage:
      chapter.data.totalPages === 0
        ? 0
        : Math.round(
            (Math.max(
              0,
              Math.min(chapter.data.totalPages, currentPage - chapter.data.startPage + 1),
            ) /
              chapter.data.totalPages) *
              100,
          ),
  };
  const archived = book.data.archived;

  return (
    <div className="chapter-page page-stack">
      <Link className="button button--text" to={`/features/books/${bookId}`}>
        <ArrowLeft aria-hidden="true" /> 返回《{book.data.title}》
      </Link>
      <header className="chapter-hero">
        <BookOpen aria-hidden="true" />
        <div>
          <p className="eyebrow">章节阅读页</p>
          <h2>{chapter.data.title}</h2>
          <p>
            页码 {chapter.data.startPage}-{chapter.data.endPage} · 共 {chapter.data.totalPages} 页
          </p>
        </div>
      </header>
      <main className="chapter-reader-card">
        <ProgressBar progress={previewProgress} />
        <label className="field">
          <span>当前读到页</span>
          <input
            type="range"
            min={chapter.data.startPage - 1}
            max={chapter.data.endPage}
            value={currentPage}
            disabled={archived}
            onChange={(event) => setCurrentPage(Number(event.target.value))}
          />
          <input
            type="number"
            min={chapter.data.startPage - 1}
            max={chapter.data.endPage}
            value={currentPage}
            disabled={archived}
            onChange={(event) => setCurrentPage(Number(event.target.value))}
          />
          <small>
            {currentPage < chapter.data.startPage ? '尚未开始本章' : `已读到第 ${currentPage} 页`}
          </small>
        </label>
        <label className="field">
          <span>章节笔记</span>
          <textarea
            rows={10}
            value={notes}
            disabled={archived}
            placeholder="记录本章的要点、问题和待回顾内容…"
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        {archived ? (
          <p className="archive-hint">书籍已归档，恢复后才能继续更新章节进度。</p>
        ) : (
          <button
            type="button"
            className="button button--primary"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            <Save aria-hidden="true" /> {save.isPending ? '正在保存…' : '保存本章进度'}
          </button>
        )}
      </main>
    </div>
  );
}
