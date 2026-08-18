/**
 * The articles' shell. About and the blog are one site now — the list of
 * articles lives on About under "From the Lab" — so both ends of the page come
 * from SiteChrome and this module only re-exports them under the names the
 * article code already uses.
 */
export {
  BLOG_LIST_PATH,
  PostCard as BlogCard,
  SiteFooter as BlogFooter,
  SiteNav as BlogNav,
} from '../SiteChrome';
