---
name: kernel-filesystem-ops
description: read, write, upload, and download files in browser vm filesystems
---

# Filesystem Operations

interact with the browser vm's filesystem to upload, download, read, and write files.

## when to use

use this skill when you need to:
- **upload test data or fixtures** to browser vms for automation
- **download generated files** like screenshots, pdfs, or reports
- **provide configuration files** to scripts running in the vm
- **process data** by uploading input, running scripts, and downloading output
- **manage files and directories** in the browser vm filesystem
- **transfer artifacts** between local machine and browser vm

## prerequisites

see [prerequisites.md](../../reference/prerequisites.md) for KERNEL cli setup.

> **note**: when using `--path` or `--src` flags in the commands below, these flags are required and must be provided with a value.

## directory operations

### create directory

```bash
kernel browsers fs new-directory <session_id> --path /tmp/mydir

# With custom permissions
kernel browsers fs new-directory <session_id> --path /tmp/mydir --mode 0755
```

### delete directory

```bash
kernel browsers fs delete-directory <session_id> --path /tmp/mydir
```

### list files

```bash
# List files in a directory
kernel browsers fs list-files <session_id> --path /tmp

# With JSON output
kernel browsers fs list-files <session_id> --path /tmp -o json
```

### get file/directory info

```bash
# Get metadata for a file or directory
kernel browsers fs file-info <session_id> --path /tmp/file.txt

# With JSON output
kernel browsers fs file-info <session_id> --path /tmp/file.txt -o json
```

## file operations

### read file

```bash
# Read file to stdout
kernel browsers fs read-file <session_id> --path /tmp/file.txt

# Save to local file
kernel browsers fs read-file <session_id> --path /tmp/file.txt -o local-file.txt
```

### write file

```bash
# Upload local file to VM
kernel browsers fs write-file <session_id> --path /tmp/output.txt --source local.txt

# With custom permissions
kernel browsers fs write-file <session_id> --path /tmp/output.txt --source local.txt --mode 0644
```

### delete file

```bash
kernel browsers fs delete-file <session_id> --path /tmp/file.txt
```

### move/rename file

```bash
# Move or rename a file
kernel browsers fs move <session_id> --src /tmp/old.txt --dest /tmp/new.txt
```

### set permissions

```bash
# Change file mode
kernel browsers fs set-permissions <session_id> --path /tmp/file.txt --mode 0755

# Change owner and group
kernel browsers fs set-permissions <session_id> --path /tmp/file.txt --mode 0755 --owner user --group group
```

## bulk operations

### upload files

```bash
# Upload with mapping (local:remote)
kernel browsers fs upload <session_id> --file "local.txt:/tmp/remote.txt"

# Multiple files
kernel browsers fs upload <session_id> --file "file1.txt:/tmp/file1.txt" --file "file2.txt:/tmp/file2.txt"

# Upload to destination directory
kernel browsers fs upload <session_id> --dest-dir /tmp --paths "file1.txt,file2.txt"
```

### upload zip archive

```bash
# Upload and extract a zip file
kernel browsers fs upload-zip <session_id> --zip archive.zip --dest-dir /tmp/extracted
```
> **note**: when using `--zip` or `--dest-dir` are required and must be provided with a value.

### download directory as zip

```bash
kernel browsers fs download-dir-zip <session_id> --path /tmp/data -o data.zip
```

## use cases

- **test data**: upload fixtures and test data for automated tests
- **configuration**: provide config files to scripts and applications
- **data processing**: upload input, run processing scripts, download output
- **screenshots/artifacts**: collect generated files like screenshots, pdfs, reports
- **scripts**: upload custom automation or processing scripts
- **file management**: organize, move, and manage files in the vm
- **batch operations**: upload/download multiple files or entire directories
