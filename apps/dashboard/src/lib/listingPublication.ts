/** Copy only: the real authenticated role still controls all server actions. */
export function adminListingAction(editing: boolean, status?: string) {
  if (!editing) return {
    note: 'submit_listing_page.admin_publish_note',
    button: 'submit_listing_page.admin_publish_btn',
    toast: 'submit_listing_page.admin_toast_published',
  }
  if (status === 'active') return {
    note: 'submit_listing_page.admin_live_edit_note',
    button: 'submit_listing_page.admin_save_live_btn',
    toast: 'submit_listing_page.admin_toast_live_saved',
  }
  if (status === 'rejected') return {
    note: 'submit_listing_page.admin_rejected_edit_note',
    button: 'submit_listing_page.admin_resubmit_btn',
    toast: 'submit_listing_page.admin_toast_resubmitted',
  }
  return {
    note: 'submit_listing_page.admin_edit_note',
    button: 'submit_listing_page.admin_save_btn',
    toast: 'submit_listing_page.admin_toast_saved',
  }
}
