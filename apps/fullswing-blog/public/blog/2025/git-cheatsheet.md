Undo last X commits to cherry-pick changes
```bash
# this will undo the last commit
git reset HEAD~1
# find the commit hash before the last commit with the correct changes for those files, this will also discard the changes
git restore --source <commit sha> file1, file2, etc
# add back the changes you do want
git add file1, file2, etc
# push the new commit 
git commit -m "remove unneeded changes"
git push
```

Configure new Git installation
```
git config --global user.name "Jebb Burditt"
git config --global user.email "jebb.burditt@gmail.com"
```

Prune branches after merging to trunk
```
git config --global fetch.prune true
```

Merge in latest changes to current feature branch
```
git stash
git fetch origin develop:develop
git merge develop
git stash pop
```