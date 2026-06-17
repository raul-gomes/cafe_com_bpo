/**
 * Café com BPO - Frontend Components
 * 
 * Centralized export for all component modules.
 */

// Auth components
export { LoginForm } from './auth/LoginForm'
export { RegisterForm } from './auth/RegisterForm'
export { ProtectedRoute } from './auth/ProtectedRoute'
export { RegisterModal } from './auth/RegisterModal'

// Panel components
export { PanelLayout } from './panel/PanelLayout'
export { PanelNavbar } from './panel/PanelNavbar'
export { PanelSidebar } from './panel/PanelSidebar'
export { NotificationBell } from './panel/NotificationBell'
export { DeleteConfirmModal } from './panel/DeleteConfirmModal'

// Pricing components
export { PricingForm } from './pricing/PricingForm'
export { PricingCalculatorLayout } from './pricing/PricingCalculatorLayout'
export { PublicPricingSimulator } from './pricing/PublicPricingSimulator'

// Proposal components
export { ProposalPreview } from './proposal/ProposalPreview'
export { ProposalDownloadGate } from './proposal/ProposalDownloadGate'

// Tasks components
export { TaskModal } from './tasks/TaskModal'

// PDF components
export { ProposalDocument } from './pdf/ProposalDocument'

// Dashboard components
export { ProposalListCard } from './dashboard/ProposalListCard'

// UI components
export { Button } from './ui/button'
export { FadeIn } from './ui/FadeIn'
export { Navbar } from './ui/Navbar'
export { RichTextEditor } from './ui/RichTextEditor'
export { CurrencyInput } from './ui/CurrencyInput'
export { MaskedCPF, MaskedCNPJ, MaskedPhone, MaskedDate } from './ui/MaskedInput'

// Confirm (hooks + providers)
export { ConfirmProvider, useConfirm } from './ui/ConfirmDialog'
