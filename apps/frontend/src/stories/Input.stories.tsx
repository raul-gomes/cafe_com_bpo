import type { Meta, StoryObj } from '@storybook/react'
import { Input } from '../components/ui/input'

const meta: Meta<typeof Input> = {
  title: 'Design System/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: { control: 'select', options: ['text', 'email', 'password', 'number', 'tel', 'url'] },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {
  args: {
    placeholder: 'Digite algo...',
  },
}

export const WithValue: Story = {
  args: {
    defaultValue: 'Valor preenchido',
  },
}

export const Disabled: Story = {
  args: {
    placeholder: 'Desabilitado',
    disabled: true,
  },
}

export const Email: Story = {
  args: {
    type: 'email',
    placeholder: 'email@exemplo.com',
  },
}
