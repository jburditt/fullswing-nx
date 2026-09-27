```bash
# this will undo the last commit
git reset HEAD~1
# find the commit hash before the last commit with the correct changes for those files, this will also discard the changes
git restore --source <commit before changes> file1, file2, etc
# add back the changes you do want
git add file1, file2, etc
# push the new commit 
git commit -m "remove unneeded changes"
git push
```
