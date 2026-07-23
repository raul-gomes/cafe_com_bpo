import type { Meta, StoryObj } from '@storybook/react-vite'
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert'

const meta: Meta<typeof Alert> = {
  title: 'Design System/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Alert>

export const Default: Story = {
  render: () => (
    <Alert>
      <AlertTitle>Informação</AlertTitle>
      <AlertDescription>
        Esta é uma mensagem informativa para o usuário.
      </AlertDescription>
    </Alert>
  ),
}

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive">
      <AlertTitle>Erro</AlertTitle>
      <AlertDescription>
        Ocorreu um erro ao processar sua solicitação.
      </AlertDescription>
    </Alert>
  ),
}

export const Simple: Story = {
  render: () => (
    <Alert>
      <AlertDescription>
        Alerta simples sem título, apenas descrição.
      </AlertDescription>
    </Alert>
  ),
}
