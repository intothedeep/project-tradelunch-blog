'use client';

// Thin barrel — re-exports every public name from the split sibling modules.
// Import path @/components/ui/sidebar remains unchanged for all consumers.

export { useSidebar, SidebarProvider } from '@/components/ui/sidebar-context';

export {
    Sidebar,
    SidebarTrigger,
    SidebarRail,
    SidebarInset,
    SidebarInput,
    SidebarHeader,
    SidebarFooter,
    SidebarSeparator,
    SidebarContent,
} from '@/components/ui/sidebar-primitives';

export {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupAction,
    SidebarGroupContent,
} from '@/components/ui/sidebar-group';

export {
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarMenuAction,
    SidebarMenuBadge,
    SidebarMenuSkeleton,
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton,
    sidebarMenuButtonVariants,
} from '@/components/ui/sidebar-menu';
