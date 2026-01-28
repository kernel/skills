---
name: kernel-filesystem-ops
description: Read, write, upload, and download files in browser VM filesystems
---

# Filesystem Operations

Interact with the browser VM's filesystem to upload, download, read, and write files.

## When to Use

Use this skill when you need to:
- **Upload test data or fixtures** to browser VMs for automation
- **Download generated files** like screenshots, PDFs, or reports
- **Provide configuration files** to scripts running in the VM
- **Process data** by uploading input, running scripts, and downloading output
- **Manage files and directories** in the browser VM filesystem
- **Transfer artifacts** between local machine and browser VM

## Prerequisites

See [prerequisites.md](../../reference/prerequisites.md) for Kernel CLI setup.

> **Note**: When using `--path` or `--src` flags in the commands below, these flags are required and must be provided with a value.

## Directory Operations

### Create Directory

```bash
kernel browsers fs new-directory <session_id> --path /tmp/mydir

# With custom permissions
kernel browsers fs new-directory <session_id> --path /tmp/mydir --mode 0755
```

### Delete Directory

```bash
kernel browsers fs delete-directory <session_id> --path /tmp/mydir
```

### List Files

```bash
# List files in a directory
kernel browsers fs list-files <session_id> --path /tmp

# With JSON output
kernel browsers fs list-files <session_id> --path /tmp -o json
```

### Get File/Directory Info

```bash
# Get metadata for a file or directory
kernel browsers fs file-info <session_id> --path /tmp/file.txt

# With JSON output
kernel browsers fs file-info <session_id> --path /tmp/file.txt -o json
```

## File Operations

### Read File

```bash
# Read file to stdout
kernel browsers fs read-file <session_id> --path /tmp/file.txt

# Save to local file
kernel browsers fs read-file <session_id> --path /tmp/file.txt -o local-file.txt
```

### Write File

```bash
# Upload local file to VM
kernel browsers fs write-file <session_id> --path /tmp/output.txt --source local.txt

# With custom permissions
kernel browsers fs write-file <session_id> --path /tmp/output.txt --source local.txt --mode 0644
```

### Delete File

```bash
kernel browsers fs delete-file <session_id> --path /tmp/file.txt
```

### Move/Rename File

```bash
# Move or rename a file
kernel browsers fs move <session_id> --src /tmp/old.txt --dest /tmp/new.txt
```

### Set Permissions

```bash
# Change file mode
kernel browsers fs set-permissions <session_id> --path /tmp/file.txt --mode 0755

# Change owner and group
kernel browsers fs set-permissions <session_id> --path /tmp/file.txt --mode 0755 --owner user --group group
```

## Bulk Operations

### Upload Files

```bash
# Upload with mapping (local:remote)
kernel browsers fs upload <session_id> --file "local.txt:/tmp/remote.txt"

# Multiple files
kernel browsers fs upload <session_id> --file "file1.txt:/tmp/file1.txt" --file "file2.txt:/tmp/file2.txt"

# Upload to destination directory
kernel browsers fs upload <session_id> --dest-dir /tmp --paths "file1.txt,file2.txt"
```

### Upload ZIP Archive

```bash
# Upload and extract a zip file
kernel browsers fs upload-zip <session_id> --zip archive.zip --dest-dir /tmp/extracted
```
> **Note**: When using `--zip` or `--dest-dir` are required and must be provided with a value.

### Download Directory as ZIP

```bash
kernel browsers fs download-dir-zip <session_id> --path /tmp/data -o data.zip
```

## Use Cases

- **Test data**: Upload fixtures and test data for automated tests
- **Configuration**: Provide config files to scripts and applications
- **Data processing**: Upload input, run processing scripts, download output
- **Screenshots/artifacts**: Collect generated files like screenshots, PDFs, reports
- **Scripts**: Upload custom automation or processing scripts
- **File management**: Organize, move, and manage files in the VM
- **Batch operations**: Upload/download multiple files or entire directories
