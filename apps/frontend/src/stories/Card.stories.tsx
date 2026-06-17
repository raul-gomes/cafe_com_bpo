import type { Meta, StoryObj } from '@storybook/react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card'

const meta: Meta<typeof Card> = {
  title: 'Design System/Card',
  component: Card,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Título do Card</CardTitle>
        <CardDescription>Descrição opcional do card</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Conteúdo principal do card. Pode conter qualquer elemento.</p>
      </CardContent>
      <CardFooter>
        <p className="text-muted-foreground text-xs">Rodapé do card</p>
      </CardFooter>
    </Card>
  ),
}

export const OnlyContent: Story = {
  render: () => (
    <Card className="w-80">
      <CardContent>
        <p>Card sem header nem footer, apenas conteúdo.</p>
      </CardContent>
    </Card>
  ),
}
