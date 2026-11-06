import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from 'react'
import { cn } from '@/lib/utils'

export const DropdownMenu = Dropdown.Root
export const DropdownMenuTrigger = Dropdown.Trigger
export const DropdownMenuLabel = Dropdown.Label
export const DropdownMenuSeparator = () => <Dropdown.Separator className="my-1 h-px bg-border" />
export const DropdownMenuContent = forwardRef<ComponentRef<typeof Dropdown.Content>, ComponentPropsWithoutRef<typeof Dropdown.Content>>(({ className, sideOffset = 8, ...props }, ref) => (
  <Dropdown.Portal><Dropdown.Content ref={ref} sideOffset={sideOffset} className={cn('z-50 min-w-64 max-w-[calc(100vw-2rem)] rounded-lg border bg-white p-1.5 text-foreground shadow-lg', className)} {...props} /></Dropdown.Portal>
))
DropdownMenuContent.displayName = 'DropdownMenuContent'
export const DropdownMenuItem = forwardRef<ComponentRef<typeof Dropdown.Item>, ComponentPropsWithoutRef<typeof Dropdown.Item>>(({ className, ...props }, ref) => (
  <Dropdown.Item ref={ref} className={cn('flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm outline-none focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50', className)} {...props} />
))
DropdownMenuItem.displayName = 'DropdownMenuItem'
