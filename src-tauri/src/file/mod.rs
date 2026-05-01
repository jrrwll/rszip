use std::path::Path;
use std::sync::Mutex;

pub use command::*;
pub use util::*;

mod util;
mod command;

#[derive(Default)]
pub struct PendingOpenPath(pub Mutex<Option<String>>);

pub fn extract_first_directory_arg_from_iter<I, S>(args: I) -> Option<String>
where
    I: IntoIterator<Item = S>,
    S: Into<String>,
{
    args.into_iter()
        .map(Into::into)
        .skip(1)
        .filter(|arg| !arg.starts_with('-'))
        .find(|arg| Path::new(arg).is_dir())
}
