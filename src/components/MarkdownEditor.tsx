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

export function MarkdownEditor({ content, onChange, placeholder = '输入内容...' }: MarkdownEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
      }),
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  if (!editor) {
    return null
  }

  return (
    <div className="rich-editor rounded-lg bg-white/5 border border-white/10 overflow-hidden">
      <div className="editor-toolbar flex items-center gap-1 p-2 border-b border-white/10 bg-white/5">
        <ToggleButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="加粗"
        >
          <Bold className="w-4 h-4" />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="斜体"
        >
          <Italic className="w-4 h-4" />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="下划线"
        >
          <Underline className="w-4 h-4" />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="删除线"
        >
          <Strikethrough className="w-4 h-4" />
        </ToggleButton>

        <div className="w-px h-6 bg-white/10 mx-1" />

        <ToggleButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="标题 1"
        >
          <Heading1 className="w-4 h-4" />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="标题 2"
        >
          <Heading2 className="w-4 h-4" />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="标题 3"
        >
          <Heading3 className="w-4 h-4" />
        </ToggleButton>

        <div className="w-px h-6 bg-white/10 mx-1" />

        <ToggleButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="无序列表"
        >
          <List className="w-4 h-4" />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="有序列表"
        >
          <ListOrdered className="w-4 h-4" />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="引用"
        >
          <Quote className="w-4 h-4" />
        </ToggleButton>
        <ToggleButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          title="行内代码"
        >
          <Code className="w-4 h-4" />
        </ToggleButton>

        <div className="w-px h-6 bg-white/10 mx-1" />

        <ToolbarButton
          onClick={() => {
            const url = window.prompt('输入链接地址：')
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          title="插入链接"
        >
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            const url = window.prompt('输入图片地址：')
            if (url) editor.chain().focus().setImage({ src: url }).run()
          }}
          title="插入图片"
        >
          <ImageIcon className="w-4 h-4" />
        </ToolbarButton>

        <div className="flex-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="撤销"
        >
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="重做"
        >
          <Redo className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <div className="prose prose-invert prose-sm max-w-none p-4 min-h-[300px]">
        <EditorContent editor={editor} className="text-white focus:outline-none" />
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
        isActive ? 'bg-purple-500/20 text-purple-400' : 'text-slate-400 hover:bg-white/10 hover:text-white'
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
        disabled ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}
