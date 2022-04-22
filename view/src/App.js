import { useEffect } from 'react';
import hljs from 'highlight.js/lib/core';
import 'highlight.js/styles/base16/tomorrow.css';
import ubotlang from './lang/ubscript';

function App() {
  useEffect(() => {
    const main = document.getElementById('document');
    hljs.registerLanguage('ubot', ubotlang);
    hljs.highlightAll(main);
  });
  return (
    <div className="main-part">
      <div className="main-header">
        <div className="logo">
          <div className="logo-up">
            <img className='logo-img' src='ubotscriptlogo.png' alt='ubot logotype'></img>
          </div>
          <div className="logo-down">v 0.8 pre</div>
        </div>
      </div>
      <div id="document"className="main-document">
        <p>
          Язык программирования, который косит под функциональный (но на самом деле нет). 
          Скрипт транслируется в javascript. 
        </p>

        

        <h1>Установка</h1>
        <p>
          Все очень просто
        </p>
        <pre>
          <code>
            $ npm i -g ub-script 
          </code>
        </pre>



        <h1>Начало</h1>
        <p>
          Теперь настроим проект. В новой пустой директории создадим файл <code>main.ubot</code>. Напишем
        </p>
        <pre>
          <code>
            $ ubot init
          </code>
        </pre>
        <p>
          После команды был создан файл с конфигурацией <code>ubot.yaml</code>. 
          В нем содержится основная информация для сборки проекта. 
        </p>
        <p>
          Теперь работаем в файле  <code>main.ubot</code>
        </p>
        <pre>
          <code className="language-ubot">
            {
`:main main args
    # Думаю понятно, что он делает
    print "Wubalubadubdub!"
`
            }
          </code>
        </pre>
        <p>
          Отлично! Теперь соберем проект 
        </p>
        <pre><code>$ ubot build</code></pre>
        <p>
          И запустим
        </p>
        <pre><code>$ node index.js</code></pre>


        <h1>Основы</h1>
        <h2>Базовый синтаксис</h2>
        <pre>
          <code className="language-ubot">
            {
`:main main args
    
    # Присваивание
    x <- 10
    y <- z <- 30
    t <- true
    f <- false
    null <- nop _
    print (x + y + z) # 70

    # Вызов функций
    print (concat "a" "b" "c")
    print _ # == print()
    concat _ "a" _ "b" # == concat(null, "a", null, "b")

    # Вызов функций 2
    print !
        concat "a" !
              "b"
              "c"
    # Лямбда
    x => x + 20

    # Многострочная лямбда
    func <- x => 
        y <- getY x
        y + x
    
    # Последняя строчка - возвращаемое значение
    # Здесь например вызывается лямбда и возвращается ее значение
    func 10
    
`
            }
          </code>
        </pre>
        <p>
          Оператор <code>&lt;-</code> очень похож на обычное <code>=</code>. 
          По сути через него можно делать цепочку присваиваний.
        </p>
        <p>
          Каждая операция в языке имеет возвращаемое значение. 
        </p>
        <p>
          Значение операции на последней строке - возвращаемое значение функции.
        </p>
        <h2>Функции</h2>
        <p>
          Функции вызываются по принципу аппликации (но несовсем). 
          То есть опускаются скобки при вызове. Сначала идет название функции,
          затем через пробелы ее аргументы.

          Если аргумент не является атомарным, то он заключается в скобки.
        </p>
        <pre>
          <code className='language-ubot'>
            {
`:main main args
    lambda <- x => t1 t2 => str => concat x t1 t2 str
    str <- ((lambda "1") "2" "3") "4" # 1234
    f <- lambda "1" "2" "3" "4" # t1 t2 => str => concat "1" t1 t2 str
    # "2" "3" "4" - сгорели, это были аргументы к верхней функции
    
    to_string <- x => concat x
    to_string (30 + 40) # 70
    to_string 30 + 40 # "30" + 40
    to_string (concat "a" (concat "b" "c") "d") # abcd 
`
            }
          </code>
        </pre>
        <h2>Условный оператор</h2>
        <p>
          В языке присутствует условный оператор
        </p>
        <pre>
          <code className='language-ubot'>
            {
`:main main args
    x <- 40
    match x
        30 -> print "x is 30" # nop
        40 -> print "x is 40" # yes
        _ -> print (concat "x is " x) # otherwise
        50 -> print "Never prints :(" # unreachable
    
    x <- false
    match x
        true   -> print "true"
        "smth" -> print "lol"
        _ -> 
            lol <- "multiline case"
            match lol
              "oneline case" -> print "wrong!"
              _ -> print "match in match"

    lt <- x => y => x > y
    gt <- x => y => x < y
    and <- f g => x => f x && g x
    x <- 50
    match x
        and (lt 100) (gt 20) -> print "x between 20 and 100"
        _ -> print (concat "x is " x)
`
            }
          </code>
        </pre>
        <p>
          Слева от <code>-&gt;</code> стоит условие, при котором выполнится данная ветка кода. Справа - код, который должен выполнится
          При этом, если слева стоит переменная или атомарный символ - то они сравниваются на совпадение. 
          (Если слево стоит например объект, то они проверятся на одинаковый указатель).

          Если же слева находится функция, то она будет вызвана с аргументом текущего условия.
        </p>
        <p>
          Слева еще могут находится типы, но об этом позже.
        </p>
        <h2>А циклы?</h2>
        <p>
          А нет их! Используй рекурсию.
        </p>
        <h1>Глобальные блоки</h1>
        <h2>Подключение модулей</h2>
        <p>
          Существует 2 способа подключить файл: <code>:import</code> и <code>:use</code>
        </p>
        <pre>
          <code className='language-ubot'>
{
`# Почти c-like include
:use './path/to/ubot/file'

# translates into const express = require('express')
:import express :: 'express'
# translates into const func = require('./my/js/file')
:import func :: './my/js/file'
`
}
          </code>
        </pre>
        <h2>Функции</h2>
        <pre>
          <code>
{
`# Функция будет экпортироваться по умолчанию из js файла после трансляции
:main sum x y
    x + y

# Функция видна только внутри файла после трансляции
:fn mul x y
    x * y

`
}
          </code>
        </pre>
        <p>
          Если <code>.ubot</code> файл будет подключен через 
          <code>:use</code> то все функции "скопируются" в файл подключивший скрипт.
        </p>
        <h2>Типы</h2>
        <pre>
          <code className='language-ubot'>
{
`:decl TypeName param_x param_y
    type : 'box'
    value : param_x
    inner_dict :
        prop : true
        number : 3
        value_y : param_y
`
}
          </code>
        </pre>
        <p>
          Декларация типа
        </p>
        <h1>
          Типы
        </h1>
        <p>
          Мощный инструмент для работы с js-like объектами.
          Типы существуют только на стадии компиляции, и пропадают на рантайме.
          При этом остаются всевозможные проверки, распаковки и создание объектов.

          Объекты основные сущности pattern-match'инга.
        </p>
        <pre>
          <code className='language-ubot'>
{
`:decl Box x
    # Поле объекта и его значение
    type : 'box'
    # Поле объекта, который параметризирован x'ом
    value : x

:main main args
    # { type : "box", value : 3 }
    b <- pack "type" "box" "value" 3
    
    # Это упаковка типа. Параметр подставит значение в нужное место словаря
    b_ <- Box 3
    b__ <- Box (Box 3) # { type : 'box', value : { type : 'box', value : 3 } }

    match b
        # Если объект подходит под паттерн, который описан в :decl типа
        # Параметр принимает значение объекта
        Box v -> print (concat "b is box! With value " v)
        _ -> print "b is not a Box"

    match b__
        Box (Box v) -> print "Nested pattern" # prints
        Box v -> print v
        _ -> print "..."

    match b__
        Box v -> print v  # prints
        Box (Box v) -> print "Nested pattern"
        _ -> print "..."

    match b
        Box 3 -> print "Box with value 3"
        Box (Box 3) -> ... # ERROR
        _ -> print "..."

    trap <- pack "type" "lol" "value" "..."
    trap_ <- pack "type" "box" "value" _ # { type : 'box', value : null } - not a Box, cause of value : null
    
    # Raise runtime error. Pattern not matched
    match trap
        Box v -> print v
`
}
          </code>
        </pre>
        <p>
          Распаковка также может быть частью присваинвания. 
          Единственное ограничение - операция не безопасна.
          Если распаковываемый тип не является необходимым типом - будет кинуто исключение.
        </p>
        <pre>
          <code className='language-ubot'>
{
`:decl Box x
    type : 'box'
    value : x

:decl Vox x
    type : 'vox'
    value : x

:decl IncFunc f
    inc : f

:main main args
    obj <- pack "type" "box" "value" 42 "inc" !
              x => x + 10
    obj_ <- Box v <- IncFunc inc <- obj
    print (inc v) # 52
    print (obj == obj_) # true

    # RuntimeError Type [Vox] not matched!
    Vox v <- obj_ 

    lambda <- (Box x) _ => print x
    res <- lambda (Box 3) # ok

    lambda <- (Vox) _ => print x
    res <- lambda (Box 3) # runtime error...
`
}
          </code>
        </pre>
        <h1>Примеры</h1>
        <h2>Express</h2>
        <pre>
          <code className='language-ubot'>
{
`:import express :: 'express'

:decl App g l
  get : g
  listen : l

:decl Req q
  query : q

:decl Res s
  send : s

:decl GoodQuery x
  from : "base"
  resource : x

:main main args
  App a_get a_listen <- express _
  a_get "/" !
    (Req query) (Res send) => 
      match query
        GoodQuery r -> send (concat "Got " r "from base")
        _ -> send "Bad query, sorry :("
  a_listen !
    x => print "Server online!"
`
}
          </code>
        </pre>
      </div>
    </div>
  )
}
export default App;