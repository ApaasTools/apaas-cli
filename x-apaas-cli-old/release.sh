### 
# @Author: Devin Shi
 # @Email: yutian.shi@definesys.com
 # @Date: 2019-08-23 16:43:23
 # @LastEditTime: 2019-11-05 21:55:26
 # @LastEditors: Devin Shi
 # @Description: 
 ###
### 
# @Author: Devin Shi
 # @Email: yutian.shi@definesys.com
 # @Date: 2019-08-21 16:01:47
 # @LastEditTime: 2019-08-23 16:45:43
 # @LastEditors: Devin Shi
 # @Description: 
 ###
# 拉取分支上现有的tags
git fetch --tags

echo -e "所有tag列表"
git tag -l -n


echo -e "${tagList}"
#获取最新版本tag
LatestTag=$(git describe --tags `git rev-list --tags --max-count=1`)

echo -e "最新版本tag......"
echo -e "$LatestTag"

echo -e "请输入要新增的版本号...... 如 v1.0.1"
echo -e "此处版本号需要保持和package.json中一致，需要优先更改package.json中的版本"

#输入tag名称
read tagName

echo -e "提交代码"
git add .
git commit -m "${tagName}"
git push origin master

git tag ${tagName}
#推到分支上
git push origin ${tagName}

#推到 npm 上
npm publish
