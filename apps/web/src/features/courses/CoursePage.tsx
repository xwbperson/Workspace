import type {
  Course,
  CourseAssignment,
  CourseAssignmentInput,
  CourseClassRecord,
  CourseClassRecordInput,
  CourseInput,
  CourseMaterial,
  CourseMaterialGroup,
  CourseStatus,
} from '@workspace/client-sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArrowLeft,
  BookMarked,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  Edit3,
  ExternalLink,
  File,
  FileText,
  FolderPlus,
  GraduationCap,
  Paperclip,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal.js';
import { EmptyState, SectionError } from '../../components/ui/States.js';
import { useToast } from '../../components/ui/ToastProvider.js';
import { humanizeApiError } from '../../platform/api/client.js';
import { formatDateTime } from '../../platform/time/format.js';
import { bookApi, bookKeys } from '../books/index.js';
import { courseApi, courseKeys, invalidateCourseData } from './api.js';
import { AssignmentForm, assignmentStatusLabels } from './components/AssignmentForm.js';
import { ClassRecordForm } from './components/ClassRecordForm.js';
import { CourseForm, courseStatusLabels } from './components/CourseForm.js';

type CourseFilter = CourseStatus | 'archived';

type ConfirmTarget =
  | { kind: 'archive' | 'course-delete' }
  | { kind: 'record'; item: CourseClassRecord }
  | { kind: 'assignment'; item: CourseAssignment }
  | { kind: 'group'; item: CourseMaterialGroup }
  | { kind: 'material'; item: CourseMaterial };

export function CoursePage(): React.JSX.Element {
  const { courseId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const materialInput = useRef<HTMLInputElement>(null);
  const syllabusInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<CourseFilter>('in-progress');
  const [createOpen, setCreateOpen] = useState(params.get('create') === '1');
  const [editOpen, setEditOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<CourseClassRecord>();
  const [assignmentToEdit, setAssignmentToEdit] = useState<CourseAssignment>();
  const [groupName, setGroupName] = useState('');
  const [materialGroupId, setMaterialGroupId] = useState<string>();
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>();

  const list = useQuery({
    queryKey: courseKeys.list(filter),
    queryFn: () => courseApi.list(filter),
  });
  const detail = useQuery({
    queryKey: courseKeys.detail(courseId ?? ''),
    queryFn: () => courseApi.get(courseId!),
    enabled: Boolean(courseId),
  });
  const books = useQuery({
    queryKey: bookKeys.list('course-picker'),
    queryFn: () => bookApi.list({ archived: false }),
  });
  const selected = detail.data ?? list.data?.items.find((course) => course.id === courseId);
  const courses = useMemo(() => list.data?.items ?? [], [list.data]);

  const create = useMutation({
    mutationFn: (input: CourseInput) => courseApi.create(input),
    onSuccess: async (course) => {
      await invalidateCourseData();
      setCreateOpen(false);
      setFilter(course.status);
      show('课程已添加');
      void navigate(`/features/courses/${course.id}`, { replace: true });
    },
  });
  const update = useMutation({
    mutationFn: ({ course, input }: { course: Course; input: CourseInput }) =>
      courseApi.update(course.id, { ...input, version: course.version }),
    onSuccess: async (course) => {
      await invalidateCourseData();
      setEditOpen(false);
      setFilter(course.status);
      show('课程已更新');
    },
  });
  const archiveCourse = useMutation({
    mutationFn: (course: Course) => courseApi.archive(course.id, course.version),
    onSuccess: async () => {
      await invalidateCourseData();
      setConfirmTarget(undefined);
      show('课程已归档');
      void navigate('/features/courses', { replace: true });
    },
  });
  const restoreCourse = useMutation({
    mutationFn: (course: Course) => courseApi.restore(course.id, course.version),
    onSuccess: async (course) => {
      await invalidateCourseData();
      setFilter(course.status);
      show('课程已恢复');
      void navigate('/features/courses', { replace: true });
    },
  });
  const deleteCourse = useMutation({
    mutationFn: (course: Course) => courseApi.deletePermanently(course.id, course.version),
    onSuccess: async () => {
      await invalidateCourseData();
      setConfirmTarget(undefined);
      show('课程已永久删除');
      void navigate('/features/courses', { replace: true });
    },
  });
  const saveRecord = useMutation({
    mutationFn: ({ course, input }: { course: Course; input: CourseClassRecordInput }) =>
      recordToEdit
        ? courseApi.updateClassRecord(course.id, recordToEdit.id, {
            ...input,
            version: recordToEdit.version,
          })
        : courseApi.createClassRecord(course.id, input),
    onSuccess: async () => {
      await invalidateCourseData();
      setRecordOpen(false);
      setRecordToEdit(undefined);
      show('上课记录已保存');
    },
  });
  const deleteRecord = useMutation({
    mutationFn: ({ course, item }: { course: Course; item: CourseClassRecord }) =>
      courseApi.deleteClassRecord(course.id, item.id, item.version),
    onSuccess: async () => {
      await invalidateCourseData();
      setConfirmTarget(undefined);
      show('上课记录已删除');
    },
  });
  const saveAssignment = useMutation({
    mutationFn: ({ course, input }: { course: Course; input: CourseAssignmentInput }) =>
      assignmentToEdit
        ? courseApi.updateAssignment(course.id, assignmentToEdit.id, {
            ...input,
            version: assignmentToEdit.version,
          })
        : courseApi.createAssignment(course.id, input),
    onSuccess: async () => {
      await invalidateCourseData();
      setAssignmentOpen(false);
      setAssignmentToEdit(undefined);
      show('作业已保存');
    },
  });
  const deleteAssignment = useMutation({
    mutationFn: ({ course, item }: { course: Course; item: CourseAssignment }) =>
      courseApi.deleteAssignment(course.id, item.id, item.version),
    onSuccess: async () => {
      await invalidateCourseData();
      setConfirmTarget(undefined);
      show('作业已删除');
    },
  });
  const createGroup = useMutation({
    mutationFn: ({ course, name }: { course: Course; name: string }) =>
      courseApi.createMaterialGroup(course.id, name),
    onSuccess: async () => {
      await invalidateCourseData();
      setGroupOpen(false);
      setGroupName('');
      show('资料组已添加');
    },
  });
  const deleteGroup = useMutation({
    mutationFn: ({ course, item }: { course: Course; item: CourseMaterialGroup }) =>
      courseApi.deleteMaterialGroup(course.id, item.id, item.version),
    onSuccess: async () => {
      await invalidateCourseData();
      setConfirmTarget(undefined);
      show('资料组已删除，其中文件已移到未分组');
    },
  });
  const uploadMaterial = useMutation({
    mutationFn: ({ course, file, groupId }: { course: Course; file: File; groupId?: string }) =>
      courseApi.uploadMaterial(course.id, file, groupId),
    onSuccess: async () => {
      await invalidateCourseData();
      show('资料已上传');
    },
  });
  const deleteMaterial = useMutation({
    mutationFn: ({ course, item }: { course: Course; item: CourseMaterial }) =>
      courseApi.deleteMaterial(course.id, item.id, item.version),
    onSuccess: async () => {
      await invalidateCourseData();
      setConfirmTarget(undefined);
      show('资料已从课程移除');
    },
  });
  const uploadSyllabus = useMutation({
    mutationFn: async ({ course, file }: { course: Course; file: File }) => {
      const stored = await courseApi.uploadFile(file);
      return courseApi.update(course.id, { syllabusFileId: stored.id, version: course.version });
    },
    onSuccess: async () => {
      await invalidateCourseData();
      show('教学大纲已上传');
    },
  });

  const mutationError =
    create.error ??
    update.error ??
    archiveCourse.error ??
    restoreCourse.error ??
    deleteCourse.error ??
    saveRecord.error ??
    deleteRecord.error ??
    saveAssignment.error ??
    deleteAssignment.error ??
    createGroup.error ??
    deleteGroup.error ??
    uploadMaterial.error ??
    deleteMaterial.error ??
    uploadSyllabus.error;

  const confirm = (): void => {
    if (!selected || !confirmTarget) return;
    if (confirmTarget.kind === 'archive') archiveCourse.mutate(selected);
    else if (confirmTarget.kind === 'course-delete') deleteCourse.mutate(selected);
    else if (confirmTarget.kind === 'record')
      deleteRecord.mutate({ course: selected, item: confirmTarget.item });
    else if (confirmTarget.kind === 'assignment')
      deleteAssignment.mutate({ course: selected, item: confirmTarget.item });
    else if (confirmTarget.kind === 'group')
      deleteGroup.mutate({ course: selected, item: confirmTarget.item });
    else if (confirmTarget.kind === 'material')
      deleteMaterial.mutate({ course: selected, item: confirmTarget.item });
  };

  return (
    <div className="course-page page-stack">
      <header className="learning-hero learning-hero--courses">
        <div>
          <p className="eyebrow">计划与执行</p>
          <h2>课程管理</h2>
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setCreateOpen(true)}
        >
          <Plus aria-hidden="true" /> 添加课程
        </button>
      </header>
      {mutationError ? (
        <SectionError title="操作没有完成" message={humanizeApiError(mutationError)} />
      ) : null}
      <div className="learning-filter" aria-label="课程状态">
        {(
          [
            ['in-progress', '进行中'],
            ['completed', '已完成'],
            ['archived', '已归档'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filter === value ? 'active' : ''}
            onClick={() => {
              setFilter(value);
              void navigate('/features/courses');
            }}
          >
            {label}
          </button>
        ))}
        <span>{courses.length} 门</span>
      </div>
      <div className={`learning-workspace ${selected ? 'learning-workspace--detail' : ''}`}>
        <section className="learning-list-panel">
          {list.isError ? (
            <SectionError message={humanizeApiError(list.error)} />
          ) : list.isLoading ? (
            <div className="skeleton-list">
              <div className="skeleton" />
            </div>
          ) : courses.length ? (
            <div className="course-list">
              {courses.map((course) => (
                <Link
                  key={course.id}
                  className={course.id === courseId ? 'active' : ''}
                  to={`/features/courses/${course.id}`}
                >
                  <span className="course-list__icon">
                    <GraduationCap aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{course.name}</strong>
                    <small>
                      {[course.courseCode, course.instructor].filter(Boolean).join(' · ') ||
                        '未填写教师和编号'}
                    </small>
                    <em>
                      {course.credits} 学分 · {course.totalHours} 学时
                    </em>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title={
                filter === 'archived'
                  ? '还没有已归档课程'
                  : filter === 'completed'
                    ? '还没有已完成课程'
                    : '还没有进行中的课程'
              }
              description={
                filter === 'archived'
                  ? '归档课程会保留在这里。'
                  : filter === 'completed'
                    ? '在编辑课程时将状态设为“已完成”，课程就会出现在这里。'
                    : '添加课程后，可以继续记录上课、作业和资料。'
              }
            />
          )}
        </section>
        <section className="learning-detail-panel">
          {detail.isLoading && courseId ? (
            <div className="skeleton skeleton--detail" />
          ) : detail.isError ? (
            <SectionError message={humanizeApiError(detail.error)} />
          ) : selected ? (
            <CourseDetail
              course={selected}
              onBack={() => void navigate('/features/courses')}
              onEdit={() => setEditOpen(true)}
              onArchive={() => setConfirmTarget({ kind: 'archive' })}
              onRestore={() => restoreCourse.mutate(selected)}
              onDelete={() => setConfirmTarget({ kind: 'course-delete' })}
              onAddRecord={() => {
                setRecordToEdit(undefined);
                setRecordOpen(true);
              }}
              onEditRecord={(item) => {
                setRecordToEdit(item);
                setRecordOpen(true);
              }}
              onDeleteRecord={(item) => setConfirmTarget({ kind: 'record', item })}
              onAddAssignment={() => {
                setAssignmentToEdit(undefined);
                setAssignmentOpen(true);
              }}
              onEditAssignment={(item) => {
                setAssignmentToEdit(item);
                setAssignmentOpen(true);
              }}
              onDeleteAssignment={(item) => setConfirmTarget({ kind: 'assignment', item })}
              onAddGroup={() => setGroupOpen(true)}
              onDeleteGroup={(item) => setConfirmTarget({ kind: 'group', item })}
              onUploadMaterial={(groupId) => {
                setMaterialGroupId(groupId);
                materialInput.current?.click();
              }}
              onDeleteMaterial={(item) => setConfirmTarget({ kind: 'material', item })}
              onUploadSyllabus={() => syllabusInput.current?.click()}
            />
          ) : (
            <div className="learning-detail-empty">
              <GraduationCap aria-hidden="true" />
              <h3>选择一门课程</h3>
              <p>课程详情和学习记录会显示在这里。</p>
            </div>
          )}
        </section>
      </div>
      <input
        ref={materialInput}
        className="sr-only"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (selected && file)
            uploadMaterial.mutate({
              course: selected,
              file,
              ...(materialGroupId ? { groupId: materialGroupId } : {}),
            });
          event.target.value = '';
        }}
      />
      <input
        ref={syllabusInput}
        className="sr-only"
        type="file"
        accept=".pdf,.doc,.docx,.html,.htm,.txt,.md"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (selected && file) uploadSyllabus.mutate({ course: selected, file });
          event.target.value = '';
        }}
      />
      <Modal
        open={createOpen}
        title="添加课程"
        onClose={() => setCreateOpen(false)}
        className="modal--wide"
      >
        <CourseForm
          books={books.data?.items ?? []}
          submitting={create.isPending}
          onSubmit={(input) => create.mutateAsync(input).then(() => undefined)}
        />
      </Modal>
      <Modal
        open={editOpen}
        title="编辑课程"
        onClose={() => setEditOpen(false)}
        className="modal--wide"
      >
        {selected ? (
          <CourseForm
            key={`${selected.id}:${selected.version}`}
            course={selected}
            books={books.data?.items ?? []}
            submitting={update.isPending}
            onSubmit={(input) =>
              update.mutateAsync({ course: selected, input }).then(() => undefined)
            }
          />
        ) : null}
      </Modal>
      <Modal
        open={recordOpen}
        title={recordToEdit ? '编辑上课记录' : '添加上课记录'}
        onClose={() => {
          setRecordOpen(false);
          setRecordToEdit(undefined);
        }}
      >
        {selected ? (
          <ClassRecordForm
            key={recordToEdit?.id ?? 'new-record'}
            {...(recordToEdit ? { record: recordToEdit } : {})}
            submitting={saveRecord.isPending}
            onSubmit={(input) =>
              saveRecord.mutateAsync({ course: selected, input }).then(() => undefined)
            }
          />
        ) : null}
      </Modal>
      <Modal
        open={assignmentOpen}
        title={assignmentToEdit ? '编辑作业' : '添加作业'}
        onClose={() => {
          setAssignmentOpen(false);
          setAssignmentToEdit(undefined);
        }}
      >
        {selected ? (
          <AssignmentForm
            key={assignmentToEdit?.id ?? 'new-assignment'}
            {...(assignmentToEdit ? { assignment: assignmentToEdit } : {})}
            submitting={saveAssignment.isPending}
            onSubmit={(input) =>
              saveAssignment.mutateAsync({ course: selected, input }).then(() => undefined)
            }
          />
        ) : null}
      </Modal>
      <Modal
        open={groupOpen}
        title="添加资料组"
        onClose={() => setGroupOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setGroupOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="button button--primary"
              disabled={!groupName.trim() || createGroup.isPending}
              onClick={() =>
                selected && createGroup.mutate({ course: selected, name: groupName.trim() })
              }
            >
              添加资料组
            </button>
          </>
        }
      >
        <label className="field">
          <span>资料组名称</span>
          <input
            autoFocus
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
          />
        </label>
      </Modal>
      <ConfirmModal
        {...(confirmTarget ? { target: confirmTarget } : {})}
        {...(selected ? { course: selected } : {})}
        onClose={() => setConfirmTarget(undefined)}
        onConfirm={confirm}
      />
    </div>
  );
}

function CourseDetail({
  course,
  onBack,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  onAddRecord,
  onEditRecord,
  onDeleteRecord,
  onAddAssignment,
  onEditAssignment,
  onDeleteAssignment,
  onAddGroup,
  onDeleteGroup,
  onUploadMaterial,
  onDeleteMaterial,
  onUploadSyllabus,
}: {
  course: Course;
  onBack(): void;
  onEdit(): void;
  onArchive(): void;
  onRestore(): void;
  onDelete(): void;
  onAddRecord(): void;
  onEditRecord(item: CourseClassRecord): void;
  onDeleteRecord(item: CourseClassRecord): void;
  onAddAssignment(): void;
  onEditAssignment(item: CourseAssignment): void;
  onDeleteAssignment(item: CourseAssignment): void;
  onAddGroup(): void;
  onDeleteGroup(item: CourseMaterialGroup): void;
  onUploadMaterial(groupId?: string): void;
  onDeleteMaterial(item: CourseMaterial): void;
  onUploadSyllabus(): void;
}): React.JSX.Element {
  const groups = [
    { kind: 'ungrouped' as const, id: undefined, name: '未分组', version: 0 },
    ...(course.materialGroups ?? []).map((group) => ({ kind: 'group' as const, ...group })),
  ];
  return (
    <article className="learning-detail">
      <button type="button" className="button button--text learning-mobile-back" onClick={onBack}>
        <ArrowLeft aria-hidden="true" /> 返回课程
      </button>
      <header className="course-detail-header">
        <div>
          <span
            className={`source-pill ${
              course.archived
                ? 'source-pill--archived'
                : course.status === 'completed'
                  ? 'source-pill--completed'
                  : ''
            }`}
          >
            {course.archived ? '已归档' : courseStatusLabels[course.status]}
          </span>
          <h2>{course.name}</h2>
          <p>
            {[course.courseCode, course.instructor].filter(Boolean).join(' · ') ||
              '未填写课程编号和教师'}
          </p>
        </div>
        <div className="learning-actions">
          {course.archived ? (
            <>
              <button type="button" className="button button--primary" onClick={onRestore}>
                <RotateCcw aria-hidden="true" /> 恢复
              </button>
              <button type="button" className="button button--danger" onClick={onDelete}>
                <Trash2 aria-hidden="true" /> 永久删除
              </button>
            </>
          ) : (
            <>
              <button type="button" className="button button--primary" onClick={onEdit}>
                <Edit3 aria-hidden="true" /> 编辑课程
              </button>
              <button type="button" className="button button--quiet" onClick={onArchive}>
                <Archive aria-hidden="true" /> 归档
              </button>
            </>
          )}
        </div>
      </header>
      <dl className="metadata-grid">
        <div>
          <dt>学分</dt>
          <dd>{course.credits}</dd>
        </div>
        <div>
          <dt>学时</dt>
          <dd>{course.totalHours}</dd>
        </div>
        <div>
          <dt>授课教师</dt>
          <dd>{course.instructor || '未填写'}</dd>
        </div>
        <div>
          <dt>上课时间</dt>
          <dd>{course.schedule || '未填写'}</dd>
        </div>
      </dl>
      {course.objectives || course.description ? (
        <section className="learning-section learning-copy-grid">
          {course.objectives ? (
            <div>
              <p className="eyebrow">教学目标</p>
              <p className="long-copy">{course.objectives}</p>
            </div>
          ) : null}
          {course.description ? (
            <div>
              <p className="eyebrow">课程简介</p>
              <p className="long-copy">{course.description}</p>
            </div>
          ) : null}
        </section>
      ) : null}
      <section className="learning-section">
        <SectionHeading
          icon={<FileText />}
          eyebrow="教学大纲"
          title={course.syllabus?.originalName ?? '尚未上传'}
          action={
            !course.archived ? (
              <button type="button" className="button button--quiet" onClick={onUploadSyllabus}>
                <Upload aria-hidden="true" /> {course.syllabus ? '更换大纲' : '上传大纲'}
              </button>
            ) : undefined
          }
        />
        {course.syllabus ? (
          <a
            className="file-row"
            href={course.syllabus.contentUrl}
            target="_blank"
            rel="noreferrer"
          >
            <FileText aria-hidden="true" />
            <span>
              <strong>{course.syllabus.originalName}</strong>
              <small>{formatSize(course.syllabus.size)}</small>
            </span>
            <ExternalLink aria-hidden="true" />
          </a>
        ) : (
          <p className="archive-hint">
            支持 PDF、Word、HTML、Markdown 等文件；点击文件可在浏览器中打开。
          </p>
        )}
      </section>
      <section className="learning-section">
        <SectionHeading
          icon={<BookMarked />}
          eyebrow="参考书"
          title={`${course.referenceBooks?.length ?? 0} 本`}
        />
        {course.referenceBooks?.length ? (
          <div className="reference-book-grid">
            {course.referenceBooks.map((book) => (
              <Link key={book.id} to={book.targetRoute}>
                <BookOpen aria-hidden="true" />
                <span>
                  <strong>{book.title}</strong>
                  <small>
                    {[book.author, book.edition].filter(Boolean).join(' · ') || '未填写作者和版次'}
                  </small>
                  <em>阅读进度 {book.progress.percentage}%</em>
                </span>
                <ExternalLink aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="archive-hint">可在编辑课程时，从书籍管理中选择参考书。</p>
        )}
      </section>
      <section className="learning-section">
        <SectionHeading
          icon={<CalendarClock />}
          eyebrow="上课记录"
          title={`${course.classRecords?.length ?? 0} 次`}
          action={
            !course.archived ? (
              <button type="button" className="button button--primary" onClick={onAddRecord}>
                <Plus aria-hidden="true" /> 添加记录
              </button>
            ) : undefined
          }
        />
        {course.classRecords?.length ? (
          <div className="timeline-list">
            {course.classRecords.map((item) => (
              <article key={item.id}>
                <time>{formatDateTime(item.occurredAt)}</time>
                <p>{item.content}</p>
                {!course.archived ? (
                  <div>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onEditRecord(item)}
                      aria-label="编辑上课记录"
                    >
                      <Edit3 />
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-button--danger"
                      onClick={() => onDeleteRecord(item)}
                      aria-label="删除上课记录"
                    >
                      <Trash2 />
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="还没有上课记录" description="每次上课后记下时间和主要内容。" />
        )}
      </section>
      <section className="learning-section">
        <SectionHeading
          icon={<ClipboardCheck />}
          eyebrow="作业管理"
          title={`${course.assignments?.length ?? 0} 项`}
          action={
            !course.archived ? (
              <button type="button" className="button button--primary" onClick={onAddAssignment}>
                <Plus aria-hidden="true" /> 添加作业
              </button>
            ) : undefined
          }
        />
        {course.assignments?.length ? (
          <div className="assignment-list">
            {course.assignments.map((item) => (
              <article key={item.id}>
                <span className={`assignment-status assignment-status--${item.status}`}>
                  {assignmentStatusLabels[item.status]}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  {item.description ? <p>{item.description}</p> : null}
                  <small>
                    {item.dueAt ? `截止：${formatDateTime(item.dueAt)}` : '没有截止时间'}
                  </small>
                </div>
                {!course.archived ? (
                  <div>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onEditAssignment(item)}
                      aria-label="编辑作业"
                    >
                      <Edit3 />
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-button--danger"
                      onClick={() => onDeleteAssignment(item)}
                      aria-label="删除作业"
                    >
                      <Trash2 />
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="还没有作业" description="添加作业后，可以记录截止时间和完成状态。" />
        )}
      </section>
      <section className="learning-section">
        <SectionHeading
          icon={<Paperclip />}
          eyebrow="资料管理"
          title={`${course.materials?.length ?? 0} 个文件`}
          action={
            !course.archived ? (
              <button type="button" className="button button--quiet" onClick={onAddGroup}>
                <FolderPlus aria-hidden="true" /> 添加资料组
              </button>
            ) : undefined
          }
        />
        <div className="material-groups">
          {groups.map((group) => {
            const items = (course.materials ?? []).filter(
              (item) => item.groupId === (group.id ?? null),
            );
            return (
              <section key={group.id ?? 'ungrouped'}>
                <header>
                  <div>
                    <strong>{group.name}</strong>
                    <small>{items.length} 个文件</small>
                  </div>
                  {!course.archived ? (
                    <div>
                      <button
                        type="button"
                        className="button button--text"
                        onClick={() => onUploadMaterial(group.id)}
                      >
                        <Upload aria-hidden="true" /> 上传
                      </button>
                      {group.kind === 'group' ? (
                        <button
                          type="button"
                          className="icon-button icon-button--danger"
                          aria-label={`删除资料组${group.name}`}
                          onClick={() => onDeleteGroup(group)}
                        >
                          <Trash2 />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </header>
                {items.length ? (
                  <div>
                    {items.map((item) => (
                      <article className="file-row" key={item.id}>
                        <File aria-hidden="true" />
                        <a href={item.file.contentUrl} target="_blank" rel="noreferrer">
                          <strong>{item.label}</strong>
                          <small>
                            {formatSize(item.file.size)} · {item.file.mimeType}
                          </small>
                        </a>
                        {!course.archived ? (
                          <button
                            type="button"
                            className="icon-button icon-button--danger"
                            aria-label={`删除资料${item.label}`}
                            onClick={() => onDeleteMaterial(item)}
                          >
                            <Trash2 />
                          </button>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p>还没有文件。</p>
                )}
              </section>
            );
          })}
        </div>
      </section>
    </article>
  );
}

function SectionHeading({
  icon,
  eyebrow,
  title,
  action,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="learning-section__heading">
      <div className="section-title-with-icon">
        <span>{icon}</span>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
      </div>
      {action}
    </div>
  );
}

function ConfirmModal({
  target,
  course,
  onClose,
  onConfirm,
}: {
  target?: ConfirmTarget;
  course?: Course;
  onClose(): void;
  onConfirm(): void;
}): React.JSX.Element {
  const labels: Record<NonNullable<ConfirmTarget>['kind'], string> = {
    archive: '归档课程',
    'course-delete': '永久删除课程',
    record: '删除上课记录',
    assignment: '删除作业',
    group: '删除资料组',
    material: '移除课程资料',
  };
  const danger = target?.kind !== 'archive';
  return (
    <Modal
      open={Boolean(target)}
      title={target ? labels[target.kind] : '确认操作'}
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
            确认
          </button>
        </>
      }
    >
      <p>
        {target?.kind === 'course-delete'
          ? `“${course?.name ?? ''}”的上课记录、作业和资料关联将一并删除，无法恢复。`
          : target?.kind === 'archive'
            ? `归档“${course?.name ?? ''}”后，所有记录仍会保留。`
            : '确定执行该操作吗？'}
      </p>
    </Modal>
  );
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
