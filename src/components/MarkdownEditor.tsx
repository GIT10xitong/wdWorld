import { t } from '@/lib/i18n'
import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
} from 'lucide-react'

interface MarkdownEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
}

export function MarkdownEditor({ content, onChange, placeholder = t('输入内容...') }: MarkdownEditorProps) {
  const placeholderRef = useRef(placeholder)
  placeholderRef.current = placeholder
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Image.configure({
        inline: true,
      }),
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: () => placeholderRef.current,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor || editor.getHTML() === content) return
    editor.commands.setContent(content, { emitUpdate: false })
  }, [content, editor])
  useEffect(() => {
    if (editor) editor.view.dispatch(editor.state.tr)
  }, [placeholder, editor])

  if (!editor) {
    return null
  }

  return (
    <div className="rich-editor rounded-lg bg-ui-soft border border-ui-line overflow-hidden">
      <div className="editor-toolbar flex items-center gap-1 p-2 border-b border-ui-line bg-ui-soft">
        <ToggleButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title={t('加粗')}
        >
          <Bold className="w-4 h-4" />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title={t('斜体')}
        >
          <Italic className="w-4 h-4" />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title={t('下划线')}
        >
          <Underline className="w-4 h-4" />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title={t('删除线')}
        >
          <Strikethrough className="w-4 h-4" />
        </ToggleButton>

        <div className="w-px h-6 bg-ui-soft mx-1" />

        <ToggleButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title={t('标题 1')}
        >
          <Heading1 className="w-4 h-4" />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title={t('标题 2')}
        >
          <Heading2 className="w-4 h-4" />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title={t('标题 3')}
        >
          <Heading3 className="w-4 h-4" />
        </ToggleButton>

        <div className="w-px h-6 bg-ui-soft mx-1" />

        <ToggleButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title={t('无序列表')}
        >
          <List className="w-4 h-4" />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title={t('有序列表')}
        >
          <ListOrdered className="w-4 h-4" />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title={t('引用')}
        >
          <Quote className="w-4 h-4" />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          title={t('行内代码')}
        >
          <Code className="w-4 h-4" />
        </ToggleButton>

        <div className="w-px h-6 bg-ui-soft mx-1" />

        <ToolbarButton
          onClick={() => {
            const url = window.prompt(t('输入链接地址：'))
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          title={t('插入链接')}
        >
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            const url = window.prompt(t('输入图片地址：'))
            if (url) editor.chain().focus().setImage({ src: url }).run()
          }}
          title={t('插入图片')}
        >
          <ImageIcon className="w-4 h-4" />
        </ToolbarButton>

        <div className="flex-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title={t('撤销')}
        >
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title={t('重做')}
        >
          <Redo className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <div className="prose prose-invert prose-sm max-w-none p-4 min-h-[300px]">
        <EditorContent editor={editor} className="text-ui-text focus:outline-none" />
      </div>
    </div>
  )
}

function ToggleButton({
  children,
  onClick,
  isActive,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  isActive: boolean
  title: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg transition-colors ${
        isActive ? 'bg-ui-soft text-ui-accent' : 'text-ui-muted hover:bg-ui-hover hover:text-ui-text'
      }`}
    >
      {children}
    </button>
  )
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  title: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded-lg transition-colors ${
        disabled ? 'text-ui-muted cursor-not-allowed' : 'text-ui-muted hover:bg-ui-hover hover:text-ui-text'
      }`}
    >
      {children}
    </button>
  )
}
